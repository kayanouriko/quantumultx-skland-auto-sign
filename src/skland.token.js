/**
 * @name 森空岛小助手-token
 * @version v1.2.0
 * @description 用于获取签到所需的 token.
 * @author kayanouriko <kayanoruiko@icloud.com>
 * @homepage https://github.com/kayanouriko/quantumultx-skaland-auto-sign
 * @license MIT
 */

/** URL */
const BASE_URL = 'https://as.hypergryph.com/user/info/v1/basic'
/** 存储的 key */
const TOKEN_KEY = 'cc.kayanouriko.skland.token'

main()

function main() {
    const url = $request?.url
    if (url && url.indexOf(BASE_URL) > -1) {
        const token = url.split('=')[1]
        if (token && token.length > 0) {
            // 获取到的 token 需要解码
            const result = $prefs.setValueForKey(decodeURIComponent(token), TOKEN_KEY)
            // 发送通知
            if (result) {
                $notify('森空岛小助手-token', '', '签到所需的 token 获取成功!')
            }
        }
    }
    $done({})
}
