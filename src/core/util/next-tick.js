/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

// https://github.com/DDFE/DDFE-blog/issues/24


// 用于存放 待处理的 任务
const callbacks = []
//  false 没有启用micro或者 macro 下一个tick回调方法
//  true  表示 在添加任务 期间 
let pending = false

// 清空任务队列的方法
function flushCallbacks() {
    // pending  = false 表示此时任务队列中没有待处理任务 
    pending = false
    // 不直接处理 callbacks 是防止处理期间有任务 添加进去 
    // 那么此时pending = true 队列有任务  但是 在此已经处理了；而且也防止重复处理
    const copies = callbacks.slice(0)
    callbacks.length = 0
    for (let i = 0; i < copies.length; i++) {
        //执行每一个 任务的 callbacks.push的 匿名函数 去回调处理
        copies[i]()
    }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
let microTimerFunc
let macroTimerFunc
let useMacroTask = false

// Determine (macro) task defer implementation.  确定 任务 延迟方法
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
// 从技术上将 setImmediate 应该是最理想的选择，但是setImmediate只在ie中获得支持。
// 在同一个队列中 触发的所有DOM事件 应该使用一个队列去触发回调，这个队列就是MessageChannel
// 
// macroTimerFunc的作用就是  如果我们触发了多个更新 那么我们不应该对每一个更新都去update 更新DOM 
// 而应该在所有的方法都存放在一个队列中然后  通过setTimeout异步的方法去回调 队列中的所有的方法
/* istanbul ignore if */

// 定义 清空 macro 队列的回调方法
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
    // 如果支持 setImmediate 那么就使用setImmediate
    macroTimerFunc = () => {
        setImmediate(flushCallbacks)
    }
} else if (typeof MessageChannel !== 'undefined' && (
        isNative(MessageChannel) ||
        // PhantomJS
        MessageChannel.toString() === '[object MessageChannelConstructor]'
    )) {
    const channel = new MessageChannel()
    const port = channel.port2
    channel.port1.onmessage = flushCallbacks
    macroTimerFunc = () => {
        port.postMessage(1)
    }
} else {
    /* istanbul ignore next */
    macroTimerFunc = () => {
        setTimeout(flushCallbacks, 0)
    }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
// 定义了 清空 micro队列的 方法
if (typeof Promise !== 'undefined' && isNative(Promise)) {
    const p = Promise.resolve()
    microTimerFunc = () => {
        p.then(flushCallbacks)
        // in problematic UIWebViews, Promise.then doesn't completely break, but
        // it can get stuck in a weird state where callbacks are pushed into the
        // microtask queue but the queue isn't being flushed, until the browser
        // needs to do some other work, e.g. handle a timer. Therefore we can
        // "force" the microtask queue to be flushed by adding an empty timer.
        if (isIOS) setTimeout(noop)
    }
} else {
    // fallback to macro
    microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
export function withMacroTask(fn: Function): Function {
    return fn._withTask || (fn._withTask = function() {
        useMacroTask = true
        const res = fn.apply(null, arguments)
        useMacroTask = false
        return res
    })
}

export function nextTick(cb ? : Function, ctx ? : Object) {
    let _resolve
    callbacks.push(() => {
      // 为什么使用匿名函数？
      // JS是单线程的 所以如果某一个callback执行报错了那么后面的就不会执行
      // 所以此处使用try catch的方式保证后面的执行
        if (cb) {
            try {
                cb.call(ctx)
            } catch (e) {
                handleError(e, ctx, 'nextTick')
            }
            // 没有定义cb 且 定义了 Promise 那么执行promise的resolve()方法回调 then()
        } else if (_resolve) {
            _resolve(ctx)
        }
    })
    // 初试的时候 添加一个 macro或者micro 回调方法 那么在此主进程期间就不需要再次去 添加回调方法
    if (!pending) {
        // 所以将pending设为true 代表添加任务期间
        pending = true
        // 如果是 v-on为冒泡事件 如果也是用 micro 那么
        if (useMacroTask) {
            macroTimerFunc()
        // 默认使用micro 回调 所以回调的处理在冒泡时间之前去
        } else {
            microTimerFunc()
        }
    }
    // $flow-disable-line
    // 如果没有cb 且支持Promise 那么就返回promise 
    // 那么我们就可以使用 this.$nextTick().then(function(){})的方式
    if (!cb && typeof Promise !== 'undefined') {
        return new Promise(resolve => {
            _resolve = resolve
        })
    }
}