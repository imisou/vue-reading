/* @flow */

import { isObject, isDef } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 * 用于呈现v-for列表的运行时助手。
 */
/**
 * 
 * @param {*} val  我们定义的  v-for="item in arr" 中的 arr
 * @param {*} render 
 */
export function renderList(
    val: any,
    render: (
        val: any,
        keyOrIndex: string | number,
        index ? : number
    ) => VNode
): ? Array < VNode > {
    let ret: ? Array < VNode > , i, l, keys, key
    if (Array.isArray(val) || typeof val === 'string') {
        ret = new Array(val.length)
        for (i = 0, l = val.length; i < l; i++) {
            ret[i] = render(val[i], i)
        }
    } else if (typeof val === 'number') {
        ret = new Array(val)
        for (i = 0; i < val; i++) {
            ret[i] = render(i + 1, i)
        }
    } else if (isObject(val)) {
        keys = Object.keys(val)
        ret = new Array(keys.length)
        for (i = 0, l = keys.length; i < l; i++) {
            key = keys[i]
            ret[i] = render(val[key], key, i)
        }
    }
    if (isDef(ret)) {
        (ret: any)._isVList = true
    }
    return ret
}