/* @flow */

import { isObject, isDef } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 * 用于呈现v-for列表的运行时助手。
 */
/**

_l(object1, function(val, key, index) {
	return _c("div", { key: key }, [
		_c("p", [_v(_s(val + "---" + key + " --- " + index))])
	])
})

在 v-for 中 参数可以为 Array | Object | number | string


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

    // 处理参数为 Array类型
    if (Array.isArray(val) || typeof val === 'string') {
        ret = new Array(val.length)
        for (i = 0, l = val.length; i < l; i++) {
            // 回调 render()  参数为 val 和 index ，所以数组类型没有第三个参数
            ret[i] = render(val[i], i)
        }
    } else if (typeof val === 'number') {
        // 处理参数类型为 数字
        ret = new Array(val)
        for (i = 0; i < val; i++) {
            // 回调 render()  参数为 val 和 index ，所以数字类型没有第三个参数
            ret[i] = render(i + 1, i)
        }
    } else if (isObject(val)) {
        // 处理 对象类型参数
        keys = Object.keys(val)
        ret = new Array(keys.length)
        for (i = 0, l = keys.length; i < l; i++) {
            key = keys[i]
            // 回调 render()  参数为 val 、 key 和 index ，对象类型有3个参数
            ret[i] = render(val[key], key, i)
        }
    }
    if (isDef(ret)) {
        (ret: any)._isVList = true
    }
    return ret
}