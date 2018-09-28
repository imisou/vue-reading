/* @flow */

import { identity, resolveAsset } from 'core/util/index'

/**
 * Runtime helper for resolving filters
 * 生成过滤器的处理方法  _f()

 "_f("filterB")( _f("filterA")(message + 'xxx|bbb' + (a||b) + `cccc`) , arg1 , arg2 )"
 */
export function resolveFilter(id: string): Function {
    return resolveAsset(this.$options, 'filters', id, true) || identity
}