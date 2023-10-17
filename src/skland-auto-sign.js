/**
 * @name 森空岛小助手
 * @version v1.2.0
 * @description 每天定时自动签到森空岛获取明日方舟游戏奖励
 * @author kayanouriko <kayanoruiko@icloud.com>
 * @homepage https://github.com/kayanouriko/
 * @license MIT
 * @tanks https://github.com/sklandplus/sklandplus
 */

/**
 * 请求URL
 */
const AS_URL = 'https://as.hypergryph.com'
const OAUTH_URL = '/user/oauth2/v2/grant'

const ZONAI_URL = 'https://zonai.skland.com'
const CRED_URL = '/api/v1/user/auth/generate_cred_by_code'
const BIND_URL = '/api/v1/game/player/binding'
const SIGN_URL = '/api/v1/game/attendance'

const CODE_SUCCESS = 0
/**
 * key
 */
const TOKEN_KEY = 'cc.kayanouriko.skland.token'

// 目前来看, 签到 headers 关系不大, 直接写死.
const commonHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'User-Agent': 'Skland/1.0.1 (com.hypergryph.skland; build:100001014; Android 31; ) Okhttp/4.11.0',
    'Accept-Encoding': 'gzip',
    Connection: 'close',
    platform: '1'
}

/**
 * tiptool
 */
const msgText = {
    cookie: {
        empty: '请先打开该脚本配套的重写规则更新后打开森空岛获取签到所需参数, 再重新运行该脚本. 点击该通知将跳转获取森空岛获取参数的教程页面.',
        oauth: '通过鹰角网络通行证 Token 获取鹰角网络通行证 OAuth2 授权码失败, 请重新运行脚本, 多次失败可能是接口有变动, 请等待脚本更新.',
        cred: '通过鹰角网络通行证 OAuth2 授权码生成森空岛用户的登录凭证失败, 请重新运行脚本, 多次失败可能是接口有变动, 请等待脚本更新.',
        bind: '通过鹰角网络通行证 Cred 获取森空岛绑定的游戏角色列表失败, 请重新运行脚本, 多次失败可能是接口有变动, 请等待脚本更新.'
    },
    sign: {
        unknown: '签到成功, 但是没有获取到奖励详情.'
    }
}

main()

async function main() {
    try {
        // 先获取存储的 key
        const oauthToken = $prefs.valueForKey(TOKEN_KEY)
        if (!oauthToken) {
            throw new Error(msgText.cookie.empty)
        }
        // 前置流程
        const oauthCode = await fetchOAuth2(oauthToken)
        const { cred, token } = await fetchCred(oauthCode)
        const bindingList = await fetchBindingList(cred)
        // 开始签到
        for (const user of bindingList) {
            const { uid, channelMasterId, channelName, nickName } = user
            const { awardName, count } = await fetchSign(cred, token, uid, channelMasterId)
            //请求成功
            $notify('森空岛小助手', '', `签到成功! Dr.${nickName}(${channelName}) 获得了奖励(${awardName}x${count}).`)
            // 随机睡眠然后进行下一个签到
            await randomSleepAsync()
        }
    } catch (error) {
        const message = error.message ?? error
        if (message === msgText.cookie.empty) {
            $notify('森空岛小助手', '', message, {
                'open-url': 'https://github.com/kayanouriko/quantumultx-skland-auto-sign'
            })
        } else {
            $notify('森空岛小助手', '', message)
        }
    } finally {
        // 所有逻辑执行完必须执行该函数
        $done()
    }
}

// 获取 OAuth2 授权码
async function fetchOAuth2(token) {
    const body = {
        appCode: '4ca99fa6b56cc2ba',
        token,
        type: 0
    }
    const { status, data } = await post(AS_URL + OAUTH_URL, commonHeaders, body)
    const { code } = data
    if (status === CODE_SUCCESS && code && code.length > 0) {
        return code
    }
    // 抛出错误
    throw new Error(msgText.cookie.oauth)
}

// 获取登录凭证
async function fetchCred(oauthCode) {
    const body = {
        code: oauthCode,
        kind: 1
    }
    const { code, data } = await post(ZONAI_URL + CRED_URL, commonHeaders, body)
    const { cred, token } = data
    if (code === CODE_SUCCESS && cred && cred.length > 0 && token && token.length > 0) {
        return { cred, token }
    }
    throw new Error(msgText.cookie.cred)
}

// 获取绑定角色列表
async function fetchBindingList(cred) {
    const headers = {
        ...commonHeaders,
        cred
    }
    const { code, data } = await get(ZONAI_URL + BIND_URL, headers)
    const { list } = data
    if (code === CODE_SUCCESS && list && list.length > 0) {
        for (const item of list) {
            const { appCode, bindingList } = item
            if (appCode !== 'arknights') continue
            // 获取到绑定的游戏角色列表
            return bindingList
        }
    }
    throw new Error(msgText.cookie.bind)
}

// 签到
async function fetchSign(cred, token, uid, gameId) {
    // 1.2.0 参数验证
    // @see https://github.com/sklandplus/sklandplus
    /**
     * 签名算法:
     * POST 请求
     * 接口路径 + body参数json字符串 + 时间戳 + {platform,timestamp,dId,vName}json字符串
     * 将上面的字符串做 hmac sha256 加密, 密钥为 token. 然后加密后的字符串做 md5 即为 sign 参数.
     */
    const body = {
        uid,
        gameId
    }
    // 适当减少几秒才不会报错设备时间不对.
    const timestamp = Math.floor(Date.now() / 1000 - 1).toString()
    // 只有 timestamp 是实时的, 而且必须为字符串! 其余的可以为空的字符串, 参数顺序也不能变.
    const signHeaders = {
        platform: '',
        timestamp,
        dId: '',
        vName: ''
    }
    // JSON.stringify(signHeaders)
    // stringify 方法可能会不按顺序转化, 当出现问题的时候, 需要手写 signHeaders 的字符串保证顺序按上面的拉排列
    const value = SIGN_URL + JSON.stringify(body) + timestamp + JSON.stringify(signHeaders)
    const sign = md5(hmac_sha256(value, token))
    // 覆盖原来的参数
    const headers = {
        ...commonHeaders,
        cred,
        timestamp,
        sign
    }
    const { code, message, data } = await post(ZONAI_URL + SIGN_URL, headers, body)
    if (code === CODE_SUCCESS) {
        const awardName = data['awards'][0]['resource']['name']
        const count = data['awards'][0]['count'] ?? 0
        if (!awardName) {
            reject(msgText.sign.unknown)
        }
        return { awardName, count }
    }
    throw new Error(message)
}

//================== 辅助函数 ===================

function get(url, headers) {
    return new Promise((resolve, reject) => {
        const request = {
            url,
            headers
        }
        $task.fetch(request).then(
            response => {
                resolve(JSON.parse(response.body))
            },
            reason => {
                reject(reason.error)
            }
        )
    })
}

function post(url, headers, body) {
    return new Promise((resolve, reject) => {
        const request = {
            url,
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        }
        $task.fetch(request).then(
            response => {
                resolve(JSON.parse(response.body))
            },
            reason => {
                reject(reason.error)
            }
        )
    })
}

/** 随机睡眠 */
async function randomSleepAsync() {
    const s = random(2, 5)
    await sleep(s)
}

/** 休眠 n 秒 */
function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000))
}

/** 获取 [n, m] 区间的某个随机数 */
function random(min, max) {
    return Math.round(Math.random() * (max - min)) + min
}

/**
 * 原生 HMAC SHA256 实现
 * @see https://blog.csdn.net/yuanyuan95/article/details/127811272
 */
function hmac_sha256(message, key) {
    // To ensure cross-browser support even without a proper SubtleCrypto
    // impelmentation (or without access to the impelmentation, as is the case with
    // Chrome loaded over HTTP instead of HTTPS), this library can create SHA-256
    // HMAC signatures using nothing but raw JavaScript

    /* eslint-disable no-magic-numbers, id-length, no-param-reassign, new-cap */

    // By giving internal functions names that we can mangle, future calls to
    // them are reduced to a single byte (minor space savings in minified file)
    var uint8Array = Uint8Array
    var uint32Array = Uint32Array
    var pow = Math.pow

    // Will be initialized below
    // Using a Uint32Array instead of a simple array makes the minified code
    // a bit bigger (we lose our `unshift()` hack), but comes with huge
    // performance gains
    var DEFAULT_STATE = new uint32Array(8)
    var ROUND_CONSTANTS = []

    // Reusable object for expanded message
    // Using a Uint32Array instead of a simple array makes the minified code
    // 7 bytes larger, but comes with huge performance gains
    var M = new uint32Array(64)

    // After minification the code to compute the default state and round
    // constants is smaller than the output. More importantly, this serves as a
    // good educational aide for anyone wondering where the magic numbers come
    // from. No magic numbers FTW!
    function getFractionalBits(n) {
        return ((n - (n | 0)) * pow(2, 32)) | 0
    }

    var n = 2,
        nPrime = 0
    while (nPrime < 64) {
        // isPrime() was in-lined from its original function form to save
        // a few bytes
        var isPrime = true
        // Math.sqrt() was replaced with pow(n, 1/2) to save a few bytes
        // var sqrtN = pow(n, 1 / 2);
        // So technically to determine if a number is prime you only need to
        // check numbers up to the square root. However this function only runs
        // once and we're only computing the first 64 primes (up to 311), so on
        // any modern CPU this whole function runs in a couple milliseconds.
        // By going to n / 2 instead of sqrt(n) we net 8 byte savings and no
        // scaling performance cost
        for (var factor = 2; factor <= n / 2; factor++) {
            if (n % factor === 0) {
                isPrime = false
            }
        }
        if (isPrime) {
            if (nPrime < 8) {
                DEFAULT_STATE[nPrime] = getFractionalBits(pow(n, 1 / 2))
            }
            ROUND_CONSTANTS[nPrime] = getFractionalBits(pow(n, 1 / 3))

            nPrime++
        }

        n++
    }

    // For cross-platform support we need to ensure that all 32-bit words are
    // in the same endianness. A UTF-8 TextEncoder will return BigEndian data,
    // so upon reading or writing to our ArrayBuffer we'll only swap the bytes
    // if our system is LittleEndian (which is about 99% of CPUs)
    var LittleEndian = !!new uint8Array(new uint32Array([1]).buffer)[0]

    function convertEndian(word) {
        if (LittleEndian) {
            return (
                // byte 1 -> byte 4
                (word >>> 24) |
                // byte 2 -> byte 3
                (((word >>> 16) & 0xff) << 8) |
                // byte 3 -> byte 2
                ((word & 0xff00) << 8) |
                // byte 4 -> byte 1
                (word << 24)
            )
        } else {
            return word
        }
    }

    function rightRotate(word, bits) {
        return (word >>> bits) | (word << (32 - bits))
    }

    function sha256(data) {
        // Copy default state
        var STATE = DEFAULT_STATE.slice()

        // Caching this reduces occurrences of ".length" in minified JavaScript
        // 3 more byte savings! :D
        var legth = data.length

        // Pad data
        var bitLength = legth * 8
        var newBitLength = 512 - ((bitLength + 64) % 512) - 1 + bitLength + 65

        // "bytes" and "words" are stored BigEndian
        var bytes = new uint8Array(newBitLength / 8)
        var words = new uint32Array(bytes.buffer)

        bytes.set(data, 0)
        // Append a 1
        bytes[legth] = 0b10000000
        // Store length in BigEndian
        words[words.length - 1] = convertEndian(bitLength)

        // Loop iterator (avoid two instances of "var") -- saves 2 bytes
        var round

        // Process blocks (512 bits / 64 bytes / 16 words at a time)
        for (var block = 0; block < newBitLength / 32; block += 16) {
            var workingState = STATE.slice()

            // Rounds
            for (round = 0; round < 64; round++) {
                var MRound
                // Expand message
                if (round < 16) {
                    // Convert to platform Endianness for later math
                    MRound = convertEndian(words[block + round])
                } else {
                    var gamma0x = M[round - 15]
                    var gamma1x = M[round - 2]
                    MRound =
                        M[round - 7] +
                        M[round - 16] +
                        (rightRotate(gamma0x, 7) ^ rightRotate(gamma0x, 18) ^ (gamma0x >>> 3)) +
                        (rightRotate(gamma1x, 17) ^ rightRotate(gamma1x, 19) ^ (gamma1x >>> 10))
                }

                // M array matches platform endianness
                M[round] = MRound |= 0

                // Computation
                var t1 =
                    (rightRotate(workingState[4], 6) ^
                        rightRotate(workingState[4], 11) ^
                        rightRotate(workingState[4], 25)) +
                    ((workingState[4] & workingState[5]) ^ (~workingState[4] & workingState[6])) +
                    workingState[7] +
                    MRound +
                    ROUND_CONSTANTS[round]
                var t2 =
                    (rightRotate(workingState[0], 2) ^
                        rightRotate(workingState[0], 13) ^
                        rightRotate(workingState[0], 22)) +
                    ((workingState[0] & workingState[1]) ^ (workingState[2] & (workingState[0] ^ workingState[1])))
                for (var i = 7; i > 0; i--) {
                    workingState[i] = workingState[i - 1]
                }
                workingState[0] = (t1 + t2) | 0
                workingState[4] = (workingState[4] + t1) | 0
            }

            // Update state
            for (round = 0; round < 8; round++) {
                STATE[round] = (STATE[round] + workingState[round]) | 0
            }
        }

        // Finally the state needs to be converted to BigEndian for output
        // And we want to return a Uint8Array, not a Uint32Array
        return new uint8Array(
            new uint32Array(
                STATE.map(function (val) {
                    return convertEndian(val)
                })
            ).buffer
        )
    }

    function hmac(key, data) {
        if (key.length > 64) key = sha256(key)

        if (key.length < 64) {
            const tmp = new Uint8Array(64)
            tmp.set(key, 0)
            key = tmp
        }

        // Generate inner and outer keys
        var innerKey = new Uint8Array(64)
        var outerKey = new Uint8Array(64)
        for (var i = 0; i < 64; i++) {
            innerKey[i] = 0x36 ^ key[i]
            outerKey[i] = 0x5c ^ key[i]
        }

        // Append the innerKey
        var msg = new Uint8Array(data.length + 64)
        msg.set(innerKey, 0)
        msg.set(data, 64)

        // Has the previous message and append the outerKey
        var result = new Uint8Array(64 + 32)
        result.set(outerKey, 0)
        result.set(sha256(msg), 64)

        // Hash the previous message
        return sha256(result)
    }

    // Convert a string to a Uint8Array, SHA-256 it, and convert back to string
    const encoder = new TextEncoder('utf-8')

    function sign(inputKey, inputData) {
        const key = typeof inputKey === 'string' ? encoder.encode(inputKey) : inputKey
        const data = typeof inputData === 'string' ? encoder.encode(inputData) : inputData
        return hmac(key, data)
    }

    function hash(str) {
        return hex(sha256(encoder.encode(str)))
    }

    function hex(bin) {
        return bin.reduce((acc, val) => acc + ('00' + val.toString(16)).substr(-2), '')
    }

    return hex(sign(key, message))
}

/**
 * 原生 md5 实现
 * @see https://github.com/blueimp/JavaScript-MD5
 */
// prettier-ignore
function md5(string){function RotateLeft(lValue,iShiftBits){return(lValue<<iShiftBits)|(lValue>>>(32-iShiftBits))}function AddUnsigned(lX,lY){var lX4,lY4,lX8,lY8,lResult;lX8=(lX&0x80000000);lY8=(lY&0x80000000);lX4=(lX&0x40000000);lY4=(lY&0x40000000);lResult=(lX&0x3FFFFFFF)+(lY&0x3FFFFFFF);if(lX4&lY4){return(lResult^0x80000000^lX8^lY8)}if(lX4|lY4){if(lResult&0x40000000){return(lResult^0xC0000000^lX8^lY8)}else{return(lResult^0x40000000^lX8^lY8)}}else{return(lResult^lX8^lY8)}}function F(x,y,z){return(x&y)|((~x)&z)}function G(x,y,z){return(x&z)|(y&(~z))}function H(x,y,z){return(x^y^z)}function I(x,y,z){return(y^(x|(~z)))}function FF(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(F(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)};function GG(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(G(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)};function HH(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(H(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)};function II(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(I(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)};function ConvertToWordArray(string){var lWordCount;var lMessageLength=string.length;var lNumberOfWords_temp1=lMessageLength+8;var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1%64))/64;var lNumberOfWords=(lNumberOfWords_temp2+1)*16;var lWordArray=Array(lNumberOfWords-1);var lBytePosition=0;var lByteCount=0;while(lByteCount<lMessageLength){lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;lWordArray[lWordCount]=(lWordArray[lWordCount]|(string.charCodeAt(lByteCount)<<lBytePosition));lByteCount++}lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;lWordArray[lWordCount]=lWordArray[lWordCount]|(0x80<<lBytePosition);lWordArray[lNumberOfWords-2]=lMessageLength<<3;lWordArray[lNumberOfWords-1]=lMessageLength>>>29;return lWordArray};function WordToHex(lValue){var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;for(lCount=0;lCount<=3;lCount++){lByte=(lValue>>>(lCount*8))&255;WordToHexValue_temp="0"+lByte.toString(16);WordToHexValue=WordToHexValue+WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2)}return WordToHexValue};function Utf8Encode(string){string=string.replace(/\r\n/g,"\n");var utftext="";for(var n=0;n<string.length;n++){var c=string.charCodeAt(n);if(c<128){utftext+=String.fromCharCode(c)}else if((c>127)&&(c<2048)){utftext+=String.fromCharCode((c>>6)|192);utftext+=String.fromCharCode((c&63)|128)}else{utftext+=String.fromCharCode((c>>12)|224);utftext+=String.fromCharCode(((c>>6)&63)|128);utftext+=String.fromCharCode((c&63)|128)}}return utftext};var x=Array();var k,AA,BB,CC,DD,a,b,c,d;var S11=7,S12=12,S13=17,S14=22;var S21=5,S22=9,S23=14,S24=20;var S31=4,S32=11,S33=16,S34=23;var S41=6,S42=10,S43=15,S44=21;string=Utf8Encode(string);x=ConvertToWordArray(string);a=0x67452301;b=0xEFCDAB89;c=0x98BADCFE;d=0x10325476;for(k=0;k<x.length;k+=16){AA=a;BB=b;CC=c;DD=d;a=FF(a,b,c,d,x[k+0],S11,0xD76AA478);d=FF(d,a,b,c,x[k+1],S12,0xE8C7B756);c=FF(c,d,a,b,x[k+2],S13,0x242070DB);b=FF(b,c,d,a,x[k+3],S14,0xC1BDCEEE);a=FF(a,b,c,d,x[k+4],S11,0xF57C0FAF);d=FF(d,a,b,c,x[k+5],S12,0x4787C62A);c=FF(c,d,a,b,x[k+6],S13,0xA8304613);b=FF(b,c,d,a,x[k+7],S14,0xFD469501);a=FF(a,b,c,d,x[k+8],S11,0x698098D8);d=FF(d,a,b,c,x[k+9],S12,0x8B44F7AF);c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);a=FF(a,b,c,d,x[k+12],S11,0x6B901122);d=FF(d,a,b,c,x[k+13],S12,0xFD987193);c=FF(c,d,a,b,x[k+14],S13,0xA679438E);b=FF(b,c,d,a,x[k+15],S14,0x49B40821);a=GG(a,b,c,d,x[k+1],S21,0xF61E2562);d=GG(d,a,b,c,x[k+6],S22,0xC040B340);c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);b=GG(b,c,d,a,x[k+0],S24,0xE9B6C7AA);a=GG(a,b,c,d,x[k+5],S21,0xD62F105D);d=GG(d,a,b,c,x[k+10],S22,0x2441453);c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);b=GG(b,c,d,a,x[k+4],S24,0xE7D3FBC8);a=GG(a,b,c,d,x[k+9],S21,0x21E1CDE6);d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);c=GG(c,d,a,b,x[k+3],S23,0xF4D50D87);b=GG(b,c,d,a,x[k+8],S24,0x455A14ED);a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);d=GG(d,a,b,c,x[k+2],S22,0xFCEFA3F8);c=GG(c,d,a,b,x[k+7],S23,0x676F02D9);b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);a=HH(a,b,c,d,x[k+5],S31,0xFFFA3942);d=HH(d,a,b,c,x[k+8],S32,0x8771F681);c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);a=HH(a,b,c,d,x[k+1],S31,0xA4BEEA44);d=HH(d,a,b,c,x[k+4],S32,0x4BDECFA9);c=HH(c,d,a,b,x[k+7],S33,0xF6BB4B60);b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);d=HH(d,a,b,c,x[k+0],S32,0xEAA127FA);c=HH(c,d,a,b,x[k+3],S33,0xD4EF3085);b=HH(b,c,d,a,x[k+6],S34,0x4881D05);a=HH(a,b,c,d,x[k+9],S31,0xD9D4D039);d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);b=HH(b,c,d,a,x[k+2],S34,0xC4AC5665);a=II(a,b,c,d,x[k+0],S41,0xF4292244);d=II(d,a,b,c,x[k+7],S42,0x432AFF97);c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);b=II(b,c,d,a,x[k+5],S44,0xFC93A039);a=II(a,b,c,d,x[k+12],S41,0x655B59C3);d=II(d,a,b,c,x[k+3],S42,0x8F0CCC92);c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);b=II(b,c,d,a,x[k+1],S44,0x85845DD1);a=II(a,b,c,d,x[k+8],S41,0x6FA87E4F);d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);c=II(c,d,a,b,x[k+6],S43,0xA3014314);b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);a=II(a,b,c,d,x[k+4],S41,0xF7537E82);d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);c=II(c,d,a,b,x[k+2],S43,0x2AD7D2BB);b=II(b,c,d,a,x[k+9],S44,0xEB86D391);a=AddUnsigned(a,AA);b=AddUnsigned(b,BB);c=AddUnsigned(c,CC);d=AddUnsigned(d,DD)}var temp=WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);return temp.toLowerCase()}
