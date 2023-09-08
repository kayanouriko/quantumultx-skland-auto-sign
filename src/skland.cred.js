/**
 * @name 森空岛小助手-cred
 * @version v1.0.0
 * @description 用于获取签到所需的 cred.
 * @author kayanouriko <kayanoruiko@icloud.com>
 * @homepage https://github.com/kayanouriko/quantumultx-skaland-auto-sign
 * @license MIT
 */

/** URL */
const USER_URL = 'https://zonai.skland.com/api/v1/user'
/** 存储的 key */
const CRED_KEY = 'cc.kayanouriko.skland.cred'

main()

function main() {
    const url = $request?.url
    const headers = $request?.headers
    if (url && headers && url.indexOf(USER_URL) > -1) {
        const result = $prefs.setValueForKey(JSON.stringify(headers), CRED_KEY)
        // 发送通知
        if (result) {
            $notify('森空岛小助手-cred', '', '签到所需的 cred 获取成功!')
        } else {
            $notify('森空岛小助手-uid', '', '签到所需的 cred 存储失败, 请关闭森空岛后台重试!')
        }
    } else {
        $notify('森空岛小助手-uid', '', '签到所需的 cred 获取失败!')
    }
    $done({})
}
