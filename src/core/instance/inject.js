/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

/**
 * 初试provide属性
 * 如果我们定义provide时函数的形式 执行回调返回结果
 * 如果是对象的形式则直接赋值，并将值存在 _provide中所有我们在initInjections-resolveInject中通过_provided获取provide
 */
export function initProvide(vm: Component) {
    const provide = vm.$options.provide
    if (provide) {
        vm._provided = typeof provide === 'function' ?
            provide.call(vm) :
            provide
    }
}

/**
 * 初始化 inject 注入
 */
export function initInjections(vm: Component) {
    // 初始化inject并进行赋值处理
    const result = resolveInject(vm.$options.inject, vm)
    //TODO : 
    if (result) {
        toggleObserving(false)
        Object.keys(result).forEach(key => {
            /* istanbul ignore else */
            if (process.env.NODE_ENV !== 'production') {
                defineReactive(vm, key, result[key], () => {
                    warn(
                        `Avoid mutating an injected value directly since the changes will be ` +
                        `overwritten whenever the provided component re-renders. ` +
                        `injection being mutated: "${key}"`,
                        vm
                    )
                })
            } else {
                defineReactive(vm, key, result[key])
            }
        })
        toggleObserving(true)
    }
}

export function resolveInject(inject: any, vm: Component): ? Object {
    //如果存在inject
    if (inject) {
        // inject is :any because flow is not smart enough to figure out cached
        const result = Object.create(null)
        // 是否支持symbol
        const keys = hasSymbol
            // 通过Reflect.ownKeys获取所有的属性
            ?
            Reflect.ownKeys(inject).filter(key => {
                /* istanbul ignore next */
                // 过滤 获取一个新的可枚举的key数组
                return Object.getOwnPropertyDescriptor(inject, key).enumerable
            }) :
            Object.keys(inject)

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            // 获取 inject : { foo : {from : 'bar',default : 'foo'}}中每一个的from属性
            const provideKey = inject[key].from
            let source = vm
            // 不断向上遍历组件的provide 获取 provide的key与 from相同的属性
            while (source) {
                // 在initProvide()我们将provide处理的值赋给了_provided属性
                // 所以我们判断上级组件是否存在_provided 且 provideKey在其自身属性上
                if (source._provided && hasOwn(source._provided, provideKey)) {
                    // 获取source的值
                    result[key] = source._provided[provideKey]
                    break
                }
                source = source.$parent
            }
            // 如果遍历不到 
            if (!source) {
                // 判断 inject[provideKey]中是否定义了default属性
                if ('default' in inject[key]) {
                    // 获取default属性的值
                    const provideDefault = inject[key].default
                    // 如果是函数 就回调执行 
                    result[key] = typeof provideDefault === 'function' ?
                        provideDefault.call(vm) :
                        provideDefault
                } else if (process.env.NODE_ENV !== 'production') {
                    warn(`Injection "${key}" not found`, vm)
                }
            }
        }
        return result
    }
}