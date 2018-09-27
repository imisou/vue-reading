/* @flow */

import VNode from '../vnode'
import { createFnInvoker } from './update-listeners'
import { remove, isDef, isUndef, isTrue } from 'shared/util'



/**
 
  vnode.data.hook[声明周期(insert)] = invoker(构造函数)
  invoker = function(){}
  invoker.fns 保存了所有的 回调处理方法
  inveker.merged 表明合并成功
 
 * @param {*} def          如果def = vnode 那么  def = vnode.data.hook
 * @param {*} hookKey      vnode 生命周期名称  insert postpatch
 * @param {*} hook         回调函数
 */
export function mergeVNodeHook(def: Object, hookKey: string, hook: Function) {
    if (def instanceof VNode) {
        def = def.data.hook || (def.data.hook = {})
    }
    let invoker
    const oldHook = def[hookKey]

    function wrappedHook() {
        hook.apply(this, arguments)
        // important: remove merged hook to ensure it's called only once
        // and prevent memory leak
        // 钩子函数执行完成 后就删除当前钩子函数的回调方法，防止重复触发
        remove(invoker.fns, wrappedHook)
    }

    // 如果没有定义当前生命周期的钩子函数 hook
    if (isUndef(oldHook)) {
        // no existing hook
        // 那么就创建一个新的 回调函数
        invoker = createFnInvoker([wrappedHook])
    } else {
        /* istanbul ignore if */
        // 如果定义过 invoker 那么就直接往 invoker.fns 队列中添加此回调 方法
        if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
            // already a merged invoker
            invoker = oldHook
            invoker.fns.push(wrappedHook)
        } else {
            // existing plain hook
            // 没有fns 说明还是咩有创建钩子函数 那么还是创建新的 invoker回调函数
            invoker = createFnInvoker([oldHook, wrappedHook])
        }
    }
    // 设置回调函数 合并成功
    invoker.merged = true
    // 放在钩子函数中
    def[hookKey] = invoker
}