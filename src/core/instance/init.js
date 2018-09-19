/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin(Vue: Class < Component > ) {

    Vue.prototype._init = function(options ? : Object) {
        // vm -> this;
        const vm: Component = this
        // 我们初始化一个_uid 作为 Vue的唯一ID
        vm._uid = uid++

            // 进行性能测试
            let startTag, endTag
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            startTag = `vue-perf-start:${vm._uid}`
            endTag = `vue-perf-end:${vm._uid}`
            mark(startTag)
        }
        // 
        // a flag to avoid this being observed
        // 表明Vue是Vue对象
        vm._isVue = true
        // merge options
        // 在Vue中我们生成组件其实有两种方式 new Vue() Vue.component()
        // 如果是Vue.component() 则在执行Vue的静态方法Vue之后会在Option中添加一个属性_isComponent表明这是一个组件
        if (options && options._isComponent) {
            // optimize internal component instantiation
            // since dynamic options merging is pretty slow, and none of the
            // internal component options needs special treatment.
            initInternalComponent(vm, options)
        } else {
            // 不是通过Vue.component()创建的 那就需要处理传入的options对象进行处理
            // 如 通过混合策略 驼峰命名处理 各种属性多方式传值统一处理
            vm.$options = mergeOptions(
                resolveConstructorOptions(vm.constructor),
                options || {},
                vm
            )
        }
        /* istanbul ignore else */
        if (process.env.NODE_ENV !== 'production') {
            initProxy(vm)
        } else {
            vm._renderProxy = vm
        }
        // expose real self
        vm._self = vm

        initLifecycle(vm)
        initEvents(vm)
        initRender(vm)
        // 触发beforeCreate回调
        callHook(vm, 'beforeCreate')
        // 初始化高阶属性inject
        initInjections(vm) // resolve injections before data/props
        initState(vm)
        // 初始化高阶属性 provide
        initProvide(vm) // resolve provide after data/props
        callHook(vm, 'created')

        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            vm._name = formatComponentName(vm, false)
            mark(endTag)
            measure(`vue ${vm._name} init`, startTag, endTag)
        }

        if (vm.$options.el) {
            vm.$mount(vm.$options.el)
        }
    }
}

export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
    // 在core/intance/extend.js 的时候创建VueComponent 此处指向 VueComponent.options
    // 其跟Vue 的mergeOptions() 一样 都是以构造函数的.options为基础对象 然后进行合并
    const opts = vm.$options = Object.create(vm.constructor.options)
    // doing this because it's faster than dynamic enumeration.
    // 第一步  : options._parentVnode === App(vNode)
    // 在 create-component.js 的 createComponentInstanceForVnode()
    // 保存  _parentVnode: vnode, 所以 _parentVnode 保存的就是组件的的占位符Vnode
    const parentVnode = options._parentVnode
    // create-component.js 的 createComponentInstanceForVnode() 
    // parent : parent parent保存的是父组件 实例对象
    // 第一步 :  options.parent  === Vue
    opts.parent = options.parent
    // 保存组件的占位符Vnode
    opts._parentVnode = parentVnode

    // 我们在 render 生成VNode的时候 如果是组件类型 其会保存一个componentOptions
    // 详情请看 core/vdom/create-component.js 中createComponnet方法
    const vnodeComponentOptions = parentVnode.componentOptions
    opts.propsData = vnodeComponentOptions.propsData
    opts._parentListeners = vnodeComponentOptions.listeners
    // children 保存的就是占位符vNode的子vNode(插槽内容)  不在vNode.children上保存
    opts._renderChildren = vnodeComponentOptions.children
    // 组件占位符vNode 的 元素名称
    opts._componentTag = vnodeComponentOptions.tag

    if (options.render) {
        opts.render = options.render
        opts.staticRenderFns = options.staticRenderFns
    }
}

export function resolveConstructorOptions(Ctor: Class < Component > ) {
    // 获取组件对象的入参
    let options = Ctor.options
    // 判断其是否有父组件
    if (Ctor.super) {
        // 获取父组件的配置文件
        const superOptions = resolveConstructorOptions(Ctor.super)
        // 如果以存在superOptions字段 缓存其值
        const cachedSuperOptions = Ctor.superOptions
        // 如果不相等重新 设置
        if (superOptions !== cachedSuperOptions) {
            // super option changed,
            // need to resolve new options.
            // 父组件的配置信息修改了  需要重新设置
            Ctor.superOptions = superOptions
            // check if there are any late-modified/attached options (#4976)
            const modifiedOptions = resolveModifiedOptions(Ctor)
            // update base extend options
            if (modifiedOptions) {
                extend(Ctor.extendOptions, modifiedOptions)
            }
            options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
            if (options.name) {
                options.components[options.name] = Ctor
            }
        }
    }
    return options
}

function resolveModifiedOptions(Ctor: Class < Component > ): ? Object {
    let modified
    const latest = Ctor.options
    const extended = Ctor.extendOptions
    const sealed = Ctor.sealedOptions
    for (const key in latest) {
        if (latest[key] !== sealed[key]) {
            if (!modified) modified = {}
            modified[key] = dedupe(latest[key], extended[key], sealed[key])
        }
    }
    return modified
}

function dedupe(latest, extended, sealed) {
    // compare latest and sealed to ensure lifecycle hooks won't be duplicated
    // between merges
    if (Array.isArray(latest)) {
        const res = []
        sealed = Array.isArray(sealed) ? sealed : [sealed]
        extended = Array.isArray(extended) ? extended : [extended]
        for (let i = 0; i < latest.length; i++) {
            // push original options and not sealed options to exclude duplicated options
            if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
                res.push(latest[i])
            }
        }
        return res
    } else {
        return latest
    }
}