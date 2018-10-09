/* @flow */

import config from 'core/config'
import { hyphenate } from 'shared/util'

/**
 * 匹配 事件的按键名 event.key 与 定义的按键名是否相同，
 * @param {(T | Array < T >)} expect
 * @param {T} actual
 * @returns {boolean}
 */
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


    我们需要注意的是:
        按键的别名分为:
            1、 Vue内置的别名如 esc : ['Esc', 'Escape']
            2、 用户自定义的别名   Vue.config.keyCodes = { 'f1' : 112 }
        按键别名涉及的event属性  event.key

 * @param {*} eventKeyCode        // DOM事件回调传入的 event.keyCode 
 * @param {*} key                 // 事件按键别名 名称 'esc'
 * @param {*} builtInKeyCode      // Vue内置的事件按键别名对应的 键值。如 esc : 27
 * @param {*} eventKeyName        // DOM事件回调传入的 event.key
 * @param {*} builtInKeyName      // Vue内置的事件按键别名对应的按键名数据 builtInKeyName = ['Esc', 'Escape']
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
    /* 
        如果获取到 builtInKeyName 那么就说明其是Vue内置的别名，如esc,
        eventKeyName 是 event.key 获取当前事件的按键名，各浏览器按键名可能不同

        情况分为：
        1、  Vue内置的且用户没有通过Vue.config.keyCodes去覆盖
        2、  Vue.config.keyCodes去覆盖
        3、  都没有设置  就通过 event.key 去比较
     */ 
    if (builtInKeyName && eventKeyName && !config.keyCodes[key]) {
        // 处理第一种情况: Vue内置的且用户没有通过Vue.config.keyCodes去覆盖
        return isKeyNotMatch(builtInKeyName, eventKeyName)
    } else if (mappedKeyCode) {
        // 处理第二种： Vue.config.keyCodes去覆盖
        return isKeyNotMatch(mappedKeyCode, eventKeyCode)
    } else if (eventKeyName) {
        // 处理第三种：都没有设置  就通过 event.key 去比较
        return hyphenate(eventKeyName) !== key
    }
}