/**
 * @name 森空岛小助手-uid
 * @version v1.0.0
 * @description 用于获取签到所需的 uid.
 * @author kayanouriko <kayanoruiko@icloud.com>
 * @homepage https://github.com/kayanouriko/quantumultx-skaland-auto-sign
 * @license MIT
 */

/** URL */
const USER_URL = 'https://zonai.skland.com/api/v1/user'
/** 存储的 key */
const UID_KEY = 'cc.kayanouriko.skland.uid'

main()

function main() {
    const url = $request?.url
    const body = $response?.body
    if (url && body && url.indexOf(USER_URL) > -1) {
        const { data } = JSON.parse(body)
        const uid = data['gameStatus']['uid']
        const name = data['gameStatus']['name'] ?? '博士'
        if (uid && uid.length > 0) {
            // 获取到 uid 和 name 存储到本地
            const value = {
                uid,
                name
            }
            const result = $prefs.setValueForKey(JSON.stringify(value), UID_KEY)
            // 发送通知
            if (result) {
                $notify('森空岛小助手-uid', '', '签到所需的 uid 获取成功!')
            } else {
                $notify('森空岛小助手-uid', '', '签到所需的 uid 存储失败, 请关闭森空岛后台重试!')
            }
        } else {
            $notify('森空岛小助手-uid', '', '签到所需的 uid 获取失败!')
        }
    }
    $done({})
}
