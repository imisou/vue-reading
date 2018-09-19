/* @flow */

import {
    warn,
    remove,
    isObject,
    parsePath,
    _Set as Set,
    handleError
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'
import {noop} from "../util";
import {callHook} from "../instance/lifecycle";

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
/**
 * Watcher 订阅者对象 在Vue中我们对于Watcher一般分为三种： 渲染Watcher、ComputedWatcher、 监听Watcher
 * 渲染Watcher 是在组件mountComponent的时候时候定义的，用于当响应式数据更新的时候通知 订阅的组件即（渲染Watcher）进行更新 调用updateComponent()
 *
 * userWatcher : 是在用户定义computed属性 或者watch属性的时候进行定义的 也是用户当响应式数据更新的时候通知 userWatcher去重新计算
 *
 * 渲染Watcher：
 *  new Watcher(vm, updateComponent, noop, {
        before() {
            if (vm._isMounted) {
                callHook(vm, 'beforeUpdate')
            }
        }
    }, true )

 *
 * 计算 computedWatcher ：
 * new Watcher(
     vm,
     getter || noop,
     noop,
     computedWatcherOptions
   )
 * 监听Watcher
 *  new Watcher(vm, expOrFn, cb, options)
 *  options:{ user:true, //表明这个是一个监听watcher               }
 */
export default class Watcher {
    vm: Component;
    expression: string;
    cb: Function;
    id: number;
    deep: boolean;
    user: boolean;
    computed: boolean;
    sync: boolean;
    dirty: boolean;
    active: boolean;     // 当前watcher是否激活 当teardown 等 会active = false; 清除
    dep: Dep;
    deps: Array < Dep > ;
    newDeps: Array < Dep > ;
    depIds: SimpleSet;
    newDepIds: SimpleSet;
    before: ? Function;
    getter: Function;
    value: any;

    constructor(
        vm: Component,     // 组件实例对象 vm
        expOrFn: string | Function,   // 属性更新后 更改Component的回调函数
        cb: Function,     // cb
        options ? : ? Object,  // 配置对象
        isRenderWatcher ? : boolean     // 是否是初次渲染创建watcher
    ) {
        this.vm = vm
        if (isRenderWatcher) {
            vm._watcher = this
        }
        vm._watchers.push(this)
        // options
        if (options) {
            // 监听watcher ： 判断是否 为了发现对象内部值的变化
            this.deep = !!options.deep
            // 监听watcher : 表明这是一个监听Watcher
            this.user = !!options.user
            // 对于计算属性 this.computed = true;
            this.computed = !!options.computed
            this.sync = !!options.sync
            // 渲染Watcher  ： 用户数据变化后回调 再回调callHook('update')
            this.before = options.before
        } else {
            this.deep = this.user = this.computed = this.sync = false
        }
        this.cb = cb
        this.id = ++uid // uid for batching
        this.active = true
        this.dirty = this.computed // for computed watchers

        this.deps = []
        this.newDeps = []
        this.depIds = new Set()
        this.newDepIds = new Set()
        this.expression = process.env.NODE_ENV !== 'production' ?
            expOrFn.toString() :
            ''
        // parse expression for getter
        if (typeof expOrFn === 'function') {
            this.getter = expOrFn
        } else {
            // 对于 监听watcher 其 expOrFn 为监听的key 是一个字符串，所以其先要 获取其发布者属性
            // 如 将 obj.name 解析成为 this.getter = function(vm){ vm[obj][name]}
            this.getter = parsePath(expOrFn)
            if (!this.getter) {
                this.getter = function() {}
                process.env.NODE_ENV !== 'production' && warn(
                    `Failed watching path: "${expOrFn}" ` +
                    'Watcher only accepts simple dot-delimited paths. ' +
                    'For full control, use a function instead.',
                    vm
                )
            }
        }
        if (this.computed) {
            // 对于计算属性 先让其结果为undefined
            this.value = undefined
            // 对于 计算属性 其不仅仅是 订阅者 ，他也是一个发布者 所以定义一个 dep
            this.dep = new Dep()
        } else {
            // 对于监听Watcher 直接进行get
            this.value = this.get()
        }
    }

    /**
     * Evaluate the getter, and re-collect dependencies.
     * 重新计算getter的值，并且 重新收集此属性的依赖项
     */

    /*
        对于计算属性

           首先pushTarget(this) 使得 Dep.target指向当前计算Watcher
           然后调用缓存的getter方法 再回调方法中如果计算属性依赖其他响应式数据，
           那么就会触发响应式数据的依赖收集get方法，
           在get方法中调用dep.depend()将此计算Watcher添加到响应式数据的subs中。

        对于监听Watcher
            跟上面一样 首先pushTarget(this) 使得 Dep.target指向当前 监听Watcher
            ...
     */
    get() {
        pushTarget(this)
        let value
        const vm = this.vm
        try {
            // 进行watcher的处理函数的回调 在回调中如果依赖其他响应式数据，那么就会触发响应式数据的依赖收集get方法，
            // 在get方法中调用dep.depend()将此Watcher添加到响应式数据的subs中。
            value = this.getter.call(vm, vm)
        } catch (e) {
            if (this.user) {
                handleError(e, vm, `getter for watcher "${this.expression}"`)
            } else {
                throw e
            }
        } finally {
            // "touch" every property so they are all tracked as
            // dependencies for deep watching
            // 处理 监听Watcher中 deep : true; 的处理
            if (this.deep) {
                traverse(value)
            }
            // 此次依赖收集 完成 移除当前Dep.target
            popTarget()
            //为什么需要每次都重新收集依赖
            // TODO : 了解为什么需要cleanupDeps()
            this.cleanupDeps()
        }
        return value
    }

    /**
     * Add a dependency to this directive.
     * dep  ：  每一个属性上通过 闭包 缓存的 此属性的dep实例
     */
    addDep(dep: Dep) {
        // 当前组件 订阅的 发布者(Dep)对象
        const id = dep.id
        // 如果这个 wather 上已经 保存
        if (!this.newDepIds.has(id)) {
            this.newDepIds.add(id)
            this.newDeps.push(dep)
            if (!this.depIds.has(id)) {
                // 调用发布者 添加 此订阅者
                dep.addSub(this)
            }
        }
    }

    /**
     * Clean up for dependency collection.
     */
    cleanupDeps() {
        let i = this.deps.length
        while (i--) {
            const dep = this.deps[i]
            if (!this.newDepIds.has(dep.id)) {
                dep.removeSub(this)
            }
        }
        let tmp = this.depIds
        this.depIds = this.newDepIds
        this.newDepIds = tmp
        this.newDepIds.clear()
        tmp = this.deps
        this.deps = this.newDeps
        this.newDeps = tmp
        this.newDeps.length = 0
    }

    /**
     * Subscriber interface.
     * Will be called when a dependency changes.
     * 当响应式数据更新 发布者调用此方法来通知订阅者更新
     */
    update() {
        /* istanbul ignore else */
        if (this.computed) {
            // A computed property watcher has two modes: lazy and activated.
            // It initializes as lazy by default, and only becomes activated when
            // it is depended on by at least one subscriber, which is typically
            // another computed property or a component's render function.
            if (this.dep.subs.length === 0) {
                // In lazy mode, we don't want to perform computations until necessary,
                // so we simply mark the watcher as dirty. The actual computation is
                // performed just-in-time in this.evaluate() when the computed property
                // is accessed.
                this.dirty = true
            } else {
                // In activated mode, we want to proactively perform the computation
                // but only notify our subscribers when the value has indeed changed.
                this.getAndInvoke(() => {
                    this.dep.notify()
                })
            }
        } else if (this.sync) {
            this.run()
        } else {
            queueWatcher(this)
        }
    }

    /**
     * Scheduler job interface.
     * Will be called by the scheduler.
     */
    run() {
        if (this.active) {
            this.getAndInvoke(this.cb)
        }
    }

    getAndInvoke(cb: Function) {
        const value = this.get()
        if (
            value !== this.value ||
            // Deep watchers and watchers on Object/Arrays should fire even
            // when the value is the same, because the value may
            // have mutated.
            isObject(value) ||
            this.deep
        ) {
            // set new value
            const oldValue = this.value
            this.value = value
            this.dirty = false
            if (this.user) {
                try {
                    cb.call(this.vm, value, oldValue)
                } catch (e) {
                    handleError(e, this.vm, `callback for watcher "${this.expression}"`)
                }
            } else {
                cb.call(this.vm, value, oldValue)
            }
        }
    }

    /**
     * Evaluate and return the value of the watcher.
     * This only gets called for computed property watchers.
     */
    evaluate() {
        if (this.dirty) {
            // 触发 获取计算属性获取计算结果方法，并且将 Dep.target 指向 计算Watcher
            this.value = this.get()
            this.dirty = false
        }
        return this.value
    }

    /**
     * Depend on this watcher. Only for computed property watchers.
     * 只为计算属性 使用的方法
     */
    depend() {
        // 一般 在 调用ComputedGetter的时候 第一次Dep.target执行渲染Watcher
        // TODO: 如果 没有data且computed 没有依赖其他属性 那么Dep.target在初始化时候 什么时候指向渲染Watcher
        if (this.dep && Dep.target) {
            // 所以此时 是将渲染watcher添加到 subs中
            this.dep.depend()
        }
    }

    /**
     * Remove self from all dependencies' subscriber list.
     */
    teardown() {
        if (this.active) {
            // remove self from vm's watcher list
            // this is a somewhat expensive operation so we skip it
            // if the vm is being destroyed.
            if (!this.vm._isBeingDestroyed) {
                remove(this.vm._watchers, this)
            }
            // 调用每一个发布者的removeSub去移除此订阅者
            let i = this.deps.length
            while (i--) {
                this.deps[i].removeSub(this)
            }
            //将激活属性置位 false
            this.active = false
        }
    }
}