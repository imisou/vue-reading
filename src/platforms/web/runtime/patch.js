/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)



/**
 * 返回一个patch 函数给 Vue.prototype.__patch__ 调用
 *  此处主要使用函数柯里化  使得在 不同的平台中patch执行不同
 *
 * nodeOps : {
 *     createElement,
 *     createElementNS,
 *     ... 定义了 元素的创建方式
 * }
 *
 * modules 定义了 不同属性的处理方法
 * ref style ...
 * @type {[type]}
 */
export const patch: Function = createPatchFunction({ nodeOps, modules })
