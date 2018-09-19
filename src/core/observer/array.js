/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'
// 获取一个数组的原型对象
const arrayProto = Array.prototype
// 创建一个空的对象其原型指向数组的原型
export const arrayMethods = Object.create(arrayProto)
// 重置数组上的这些实例方法
const methodsToPatch = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function(method) {
    // cache original method
    // 缓存系统默认的处理方法
    const original = arrayProto[method]
    // Object.definedPrototype() 修改定义的数组实例方法
    def(arrayMethods, method, function mutator(...args) {
        // 先通过缓存的旧的实例方法处理获取到结果
        const result = original.apply(this, args)
        // 获取到组件上的观察者对象
        const ob = this.__ob__
        //保存了 我们添加的新的值 所以我们需要使其变成响应式的
        let inserted
        switch (method) {
            case 'push':
            case 'unshift':
                inserted = args
                break
            case 'splice':
                inserted = args.slice(2)
                break
        }
        // 调用 ob的方法 处理数组上每一个 属性 使其变成响应式的
        if (inserted) ob.observeArray(inserted)
        // notify change
        // 通知更新
        ob.dep.notify()
        return result
    })
})