/* @flow */

import {
    tip,
    toArray,
    hyphenate,
    handleError,
    formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'


/**
 *  初始化组件的时候 处理父子组件的 自定义事件
 * @author guzhanghua
 * @export
 * @param {Component} vm
 */
export function initEvents(vm: Component) {
    // 定义所有的
    vm._events = Object.create(null)
    vm._hasHookEvent = false
        // init parent attached events
    const listeners = vm.$options._parentListeners
    if (listeners) {
        updateComponentListeners(vm, listeners)
    }
}

let target: any

function add(event, fn, once) {
    if (once) {
        target.$once(event, fn)
    } else {
        target.$on(event, fn)
    }
}

function remove(event, fn) {
    target.$off(event, fn)
}

export function updateComponentListeners(
    vm: Component,
    listeners: Object,
    oldListeners: ? Object
) {
    target = vm
    updateListeners(listeners, oldListeners || {}, add, remove, vm)
    target = undefined
}

export function eventsMixin(Vue: Class < Component > ) {
    const hookRE = /^hook:/

    // 监听当前实例上的自定义事件。事件可以由vm.$emit触发。回调函数会接收所有传入事件触发函数的额外参数。
Vue.prototype.$on = function(event: string | Array < string > , fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
        for (let i = 0, l = event.length; i < l; i++) {
            this.$on(event[i], fn)
        }
    } else {
        // 将事件按照事件名称存放在vm._events属性上 
        (vm._events[event] || (vm._events[event] = [])).push(fn)
        // optimize hook:event cost by using a boolean flag marked at registration
        // instead of a hash lookup
        // TODO: hook:event 有哪些？
        if (hookRE.test(event)) {
            vm._hasHookEvent = true
        }
    }
    return vm
}
// 监听一个自定义事件，但是只触发一次，在第一次触发之后移除监听器。
Vue.prototype.$once = function(event: string, fn: Function): Component {
    const vm: Component = this

    function on() {
        vm.$off(event, on)
        fn.apply(vm, arguments)
    }
    // 用于 vm.$emit('event1',cb);这种移除指定回调的事件的时候，需要使用 cb.fn === fn,所以在on.fn中保存事件的回调对象
    on.fn = fn
    vm.$on(event, on)
    return vm
}
//  移除自定义事件监听器。
Vue.prototype.$off = function(event ? : string | Array < string > , fn ? : Function): Component {
    const vm: Component = this
    // all
    // 处理没有入参  vm.$off();  如果没有提供参数，则移除所有的事件监听器；
    if (!arguments.length) {
        vm._events = Object.create(null)
        return vm
    }
    // array of events
    // 处理 同时移除多个事件的方法 即 vm.$off(['event1','event2'])
    if (Array.isArray(event)) {
        for (let i = 0, l = event.length; i < l; i++) {
            this.$off(event[i], fn)
        }
        return vm
    }
    // specific event
    // 获取需要移除事件的回调函数
    const cbs = vm._events[event]
    // 如果不存在此事件 接受方，直接返回vm
    if (!cbs) {
        return vm
    }
    // 如果只提供了事件，则移除该事件所有的监听器；
    if (!fn) {
        vm._events[event] = null
        return vm
    }
    // 如果同时提供了事件与回调，则只移除这个回调的监听器。
    if (fn) {
        // specific handler
        let cb
        let i = cbs.length
        while (i--) {
            cb = cbs[i]
            //  on : cb=== fn ; once : cb.fn === fn
            if (cb === fn || cb.fn === fn) {
                cbs.splice(i, 1)
                break
            }
        }
    }
    return vm
}
// 触发当前实例上的事件。附加参数都会传给监听器回调。
Vue.prototype.$emit = function(event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      //  自定义事件的名称只能使用 小写字母
        const lowerCaseEvent = event.toLowerCase()
        if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
            tip(
                `Event "${lowerCaseEvent}" is emitted in component ` +
                `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
                `Note that HTML attributes are case-insensitive and you cannot use ` +
                `v-on to listen to camelCase events when using in-DOM templates. ` +
                `You should probably use "${hyphenate(event)}" instead of "${event}".`
            )
        }
    }
    // 自定义事件的回调
    let cbs = vm._events[event]
    if (cbs) {
        // 
        cbs = cbs.length > 1 ? toArray(cbs) : cbs
        // 获取 emit的 入参， 我们vm.$emit('event-name', arg1,arg2);那么这边就获取后面的 [arg1,arg2]
        const args = toArray(arguments, 1)
        for (let i = 0, l = cbs.length; i < l; i++) {
            try {
                // 执行回调
                cbs[i].apply(vm, args)
            } catch (e) {
                handleError(e, vm, `event handler for "${event}"`)
            }
        }
    }
    return vm
}
}