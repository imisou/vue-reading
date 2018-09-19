/* @flow */

import { remove, isDef } from 'shared/util'

/*
  尽管存在 prop 和事件，有的时候你仍可能需要在 JavaScript 里直接访问一个子组件。
  为了达到这个目的，你可以通过 ref 特性为这个子组件赋予一个 ID 引用。例如：

  <base-input ref="usernameInput"></base-input>
  this.$refs.usernameInput  => baseInput组件的实例vm

  <input ref="input">
  this.$refs.input.focus()  => this.$refs.input  访问的基本元素的DOM元素

  <li v-for="item in arr" ref="lis">item</li>
  this.$refs.lis    =>   [li,li,li] 元素的数组集合  当然此时 ref 是跟v-for 合用

  所以this.$refs.xx的结果可能是一个 vm ，可能是一个dom元素  ，也可能是一个 vm或者dom的数组集合

 */

export default {
    create(_: any, vnode: VNodeWithData) {
        registerRef(vnode)
    },
    update(oldVnode: VNodeWithData, vnode: VNodeWithData) {
        if (oldVnode.data.ref !== vnode.data.ref) {
            registerRef(oldVnode, true)
            registerRef(vnode)
        }
    },
    destroy(vnode: VNodeWithData) {
        registerRef(vnode, true)
    }
}

/**
 * 注册、更新、删除 组件上的ref
 * @param vnode
 * @param isRemoval    true 说明是 移除vm中此vnode的ref定义
 */
export function registerRef(vnode: VNodeWithData, isRemoval: ? boolean) {
    // 说明 ref 是在 h('div',{ref : 'xxx'}) 去定义的
    const key = vnode.data.ref
    if (!isDef(key)) return

    // 获取 vnode 的实例对象
    const vm = vnode.context
    // 如果是 占位符vnode 那就是  vnode.componentInstance 获取实例vm ；
    // 如果不是 那就获取ele获取vnode的真实元素
    const ref = vnode.componentInstance || vnode.elm
    // 如果组件上的 实例$refs属性
    const refs = vm.$refs
    if (isRemoval) {
        if (Array.isArray(refs[key])) {
            remove(refs[key], ref)
        } else if (refs[key] === ref) {
            refs[key] = undefined
        }
    } else {
		//  处理 ref 与 v-for 同时存在的情况   此时返回的应该是一个 数组
        if (vnode.data.refInFor) {
			// 判断 如果在vm.$refs上已经定义了此属性，且不是数组 那么就直接覆盖 并返回数组对象
            if (!Array.isArray(refs[key])) {
                refs[key] = [ref]
            //    如果是数组  那么就 在后面push
            } else if (refs[key].indexOf(ref) < 0) {
                // $flow-disable-line
                refs[key].push(ref)
            }
        //    在vm.$refs上定义此ref
        } else {
            refs[key] = ref
        }
    }
}