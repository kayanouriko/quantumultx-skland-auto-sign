/**
 * @name 森空岛小助手
 * @version v1.0.0
 * @description 每天定时自动签到森空岛获取明日方舟游戏奖励
 * @author kayanouriko <kayanoruiko@icloud.com>
 * @homepage https://github.com/kayanouriko/
 * @license MIT
 */

/**
 * 请求URL
 */
const SIGN_URL = 'https://zonai.skland.com/api/v1/game/attendance'
const CODE_SUCCESS = 0
/**
 * key
 */
const CRED_KEY = 'cc.kayanouriko.skland.cred'
const UID_KEY = 'cc.kayanouriko.skland.uid'

const msgText = {
    cookie: {
        empty: '请先打开该脚本配套的重写规则更新后获取 cred 和 uid, 再重新运行该脚本. 点击该通知将跳转获取 cred 和 uid 的教程页面.'
    },
    sign: {
        unknown: '签到成功, 但是没有获取到奖励详情.'
    }
}

main()

async function main() {
    try {
        // 先获取存储的 key
        const cred = $prefs.valueForKey(CRED_KEY)
        const userInfo = $prefs.valueForKey(UID_KEY)
        if (!cred || !userInfo) {
            // 还没有获取 cred uid, 通知并退出
            throw new Error(msgText.cookie.empty)
        }
        const { name, uid } = JSON.parse(userInfo)
        // 开始签到
        const { awardName, count } = await fetch(cred, uid)
        // 请求成功
        $notify('森空岛小助手', '', `签到成功! ${name} 获得了奖励(${count}x${awardName}).`)
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

function fetch(cred, uid) {
    return new Promise((resolve, reject) => {
        const headers = JSON.parse(cred)
        const data = {
            uid,
            gameId: 1
        }
        const request = {
            url: SIGN_URL,
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        }
        $task.fetch(request).then(
            response => {
                const { code, message, data } = JSON.parse(response.body)
                if (code === CODE_SUCCESS) {
                    const awardName = data['awards'][0]['resource']['name']
                    const count = data['awards'][0]['count'] ?? 0
                    if (!awardName) {
                        reject(msgText.sign.unknown)
                    }
                    resolve({ awardName, count })
                } else {
                    reject(message)
                }
            },
            reason => {
                reject(reason.error)
            }
        )
    })
}
