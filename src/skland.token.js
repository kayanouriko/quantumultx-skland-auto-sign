/**
 * @name 森空岛小助手-获取必要参数
 * @version v1.3.0
 * @description 用于获取签到所需的必要参数.
 * @author kayanouriko <kayanoruiko@icloud.com>
 * @homepage https://github.com/kayanouriko/quantumultx-skaland-auto-sign
 * @license MIT
 */

const url = {
    headers: '/api/v1/game',
    token: '/user/info/v1/basic'
}

const storage = {
    headers: 'cc.kayanouriko.skland.headers',
    token: 'cc.kayanouriko.skland.token'
}

const msgText = {
    headers: {
        success: '签到所需的 headers 获取成功!',
        failure: '签到所需的 headers 获取失败! 请退出森空岛 App 重新操作, 多次失败可能是接口有变动, 请等待脚本更新.'
    },
    token: {
        success: '签到所需的 token 获取成功!',
        failure: '签到所需的 token 获取失败! 请退出森空岛 App 重新操作, 多次失败可能是接口有变动, 请等待脚本更新.'
    }
}

main()

function main() {
    const { pathname, searchParams } = new URL($request?.url ?? '')
    // 根据路由不一样执行不同的事件
    switch (pathname) {
        case url.headers:
            getHeaders()
            break
        case url.token:
            getToken(searchParams)
            break
        default:
            break
    }
    // 需要返回一个空对象
    $done({})
}

function getHeaders() {
    const headers = $request.headers
    if (headers) {
        const result = $prefs.setValueForKey(JSON.stringify(headers), storage.headers)
        if (result) {
            notify(msgText.headers.success)
            return
        }
    }
    notify(msgText.headers.failure)
}

function getToken(searchParams) {
    const token = searchParams.get('token')
    if (token && token.length > 0) {
        // 获取到的 token 需要解码
        const result = $prefs.setValueForKey(decodeURIComponent(token), storage.token)
        if (result) {
            notify(msgText.token.success)
            return
        }
    }
    notify(msgText.token.failure)
}

function notify(message) {
    $notify('森空岛小助手-获取必要参数', '', message)
}
