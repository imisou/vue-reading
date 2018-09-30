/* @flow */

import config from 'core/config'
import { hyphenate } from 'shared/util'

function isKeyNotMatch < T > (expect: T | Array < T > , actual: T): boolean {
    if (Array.isArray(expect)) {
        return expect.indexOf(actual) === -1
    } else {
        return expect !== actual
    }
}

/**
 * Runtime helper for checking keyCodes from config.
 * exposed as Vue.prototype._k
 * passing in eventKeyName as last argument separately for backwards compat
 */

/**
 * 事件 别名按键修饰符处理
 * 
    如 'esc'
    => _k( $event.keyCode , 'esc' , 27 , $event.key , ['Esc', 'Escape'])

    如果是自定义的按键别名
    如  'f1'
    => _k( $event.keyCode , 'f1' , '' , $event.key , '' )

 * @param {*} eventKeyCode        // DOM事件回调传入的 event.keyCode 
 * @param {*} key                 // 事件按键别名 名称 'esc'
 * @param {*} builtInKeyCode      // 事件按键别名对应的 键值。如 esc : 27
 * @param {*} eventKeyName        // DOM事件回调传入的 event.key
 * @param {*} builtInKeyName      // 系统
 */
export function checkKeyCodes(
    eventKeyCode: number,
    key: string,
    builtInKeyCode ? : number | Array < number > ,
    eventKeyName ? : string,
    builtInKeyName ? : string | Array < string >
): ? boolean {
    // 通过别名获取按键的 键值
    // 如果内置的按键别名如 'esc', 那么builtInKeyCode就是generate时传入的键值 27;
    // 如果是通过 config.keyCodes = { f1 : 112 } 设置的键值别名 那么就通过config.keyCodes[key]获取 
    const mappedKeyCode = config.keyCodes[key] || builtInKeyCode

    // 处理 generate 
    if (builtInKeyName && eventKeyName && !config.keyCodes[key]) {
        return isKeyNotMatch(builtInKeyName, eventKeyName)
    } else if (mappedKeyCode) {
        return isKeyNotMatch(mappedKeyCode, eventKeyCode)
    } else if (eventKeyName) {
        return hyphenate(eventKeyName) !== key
    }
}