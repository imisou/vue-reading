/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
    def,
    warn,
    hasOwn,
    hasProto,
    isObject,
    isPlainObject,
    isPrimitive,
    isUndef,
    isValidArrayIndex,
    isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
    shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * 数据的观察者对象
 */
export class Observer {
    // 存放在 数据观察者 观察的组件 属性对象  如data props
    value: any;
    // 其观察者上存放 其发布者实例对象
    dep: Dep;
    vmCount: number; // number of vms that has this object as root $data

    constructor(value: any) {
        this.value = value
        // 定义了一个 发布者的实例
        this.dep = new Dep()
        // TODO: vmCount的作用
        this.vmCount = 0
        // 1. 将observer实例保存在 data.__ob__属性上
        // 2. 可见每一个组件对于data就一个observer实例对象  其保存在_data.__ob__属性上
        // 变成不可枚举  所以 walk的时候 defineReactive不会变成响应
        def(value, '__ob__', this);

        // 对数据类型的数据进行处理
        // 如 data(){ return [1,2,3,4]}
        if (Array.isArray(value)) {
            // 我们访问数组 其上面保存了数组的原型数据
            const augment = hasProto ?
                protoAugment :
                copyAugment
            // 如果存在 __proto__ 那么就将修改的方法放在其原型链上
            // 如果没有就直接存在数组对象上
            augment(value, arrayMethods, arrayKeys)
            this.observeArray(value)
        } else {
            // 其他类型进行处理
            this.walk(value)
        }
    }

    /**
     * Walk through each property and convert them into
     * getter/setters. This method should only be called when
     * value type is Object.
     */
    walk(obj: Object) {
        // 使对象上的每一个属性变成响应式的
        const keys = Object.keys(obj)
        for (let i = 0; i < keys.length; i++) {
            defineReactive(obj, keys[i])
        }
    }

    /**
     * Observe a list of Array items.
     */
    observeArray(items: Array < any > ) {
        for (let i = 0, l = items.length; i < l; i++) {
            // 使数组中的每一个值变成响应式的
            observe(items[i])
        }
    }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 * 将src对象  赋给 target 的原型
 * 此处的作用 主要是修改我们this.arr这种数组类型 属性，我们需要修改其原型上的实例方法
 */
function protoAugment(target, src: Object, keys: any) {
    /* eslint-disable no-proto */
    target.__proto__ = src
    /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array < string > ) {
    for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        def(target, key, src[key])
    }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
/**
 * 将一个对象 变成一个observer 其每一个属性变成响应式数据
 * @param value 我们需要处理的对象
 * @param asRootData  是否为一个根属性  如 一个vm中的data:{}就是一个根对象 而 vm.$options.data.obj.. 等等下面的就不是根对象
 * @returns {Observer|void}
 */
export function observe(value: any, asRootData: ? boolean): Observer | void {
    if (!isObject(value) || value instanceof VNode) {
        return
    }
    // 申明一个 观察者
    let ob: Observer | void
    // 判断这个属性是否已经 被 绑定过
    if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
        ob = value.__ob__
    } else if (
        shouldObserve &&
        !isServerRendering() &&
        (Array.isArray(value) || isPlainObject(value)) &&
        Object.isExtensible(value) &&
        !value._isVue
    ) {
        // 初始化一个观察者对象
        ob = new Observer(value)
    }
    
    if (asRootData && ob) {
        ob.vmCount++
    }
    return ob
}

/**
 * Define a reactive property on an Object.
 * 将data|props|computed中的某一个属性借助Object.defineProperty()变成响应式
 */
export function defineReactive(
    obj: Object,   // 处理的是哪一个对象
    key: string,   // 处理的是obj 上的哪一个属性
    val: any,      // 其初始值
    customSetter ? : ? Function,
    shallow ? : boolean    // 是否判断子属性是否为对象，false则判断
) {
    // 定义一个发布者实例
    // 使得每一个属性 都变成一个发布者 那么此属性修改了就可以通过dep.notify去通知其订阅者
    const dep = new Dep()

    // 获取data上此属性的属性描述对象
    const property = Object.getOwnPropertyDescriptor(obj, key)
    if (property && property.configurable === false) {
        return
    }

    // cater for pre-defined getter/setters
    // 缓存原来此属性上的 get/set方法
    const getter = property && property.get
    const setter = property && property.set
    if ((!getter || setter) && arguments.length === 2) {
        val = obj[key]
    }
    // 如果此属性还是对象继续向下遍历 
    let childOb = !shallow && observe(val)
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        // 依赖收集
        // 记得我们 如果 访问 this.name.obj.xx 其会依次触发 this.name的get 然后this.name.obj的get ..
        get: function reactiveGetter() {
            const value = getter ? getter.call(obj) : val
            // 在我们 mountComponent的时候 我们 new Watcher() 
            // 此时  调用了pushTarget 使得当前 Dep的静态属性 target指向 组件的 _watcher 对象
            // 那么我们在 render() 函数 转 vnode 时候 访问 某一个属性的时候就会触发此属性的
            // get 方法
            // 
            // 此时 Dep.target 指向 正在处理的组件实例的 _watcher 对象
            if (Dep.target) {
                // 调用每一个属性上的 dep实例
                dep.depend()
                // TODO: 为什么需要 childOb
                if (childOb) {
                    childOb.dep.depend()
                    if (Array.isArray(value)) {
                        dependArray(value)
                    }
                }
            }
            return value
        },
        // 派发更新
        // 当我们 在代码中使用 this.dataKey = '12312';将触发dataKey的set方法
        set: function reactiveSetter(newVal) {
            //如果我们在data的时候定义了 此属性的getter方法  那么我们就需要执行getter方法获取正确的新值
            const value = getter ? getter.call(obj) : val
            /* eslint-disable no-self-compare */
            // 如果 新值与旧值相同  就不处理了
            if (newVal === value || (newVal !== newVal && value !== value)) {
                return
            }
            /* eslint-enable no-self-compare */
            if (process.env.NODE_ENV !== 'production' && customSetter) {
                // 定义了公共的setter方法
                customSetter()
            }
            // 定义了setter方法  那么就需要调用一下setter方法
            if (setter) {
                setter.call(obj, newVal)
            } else {
                val = newVal
            }
            childOb = !shallow && observe(newVal)
            // 通知订阅者更新
            dep.notify()
        }
    })
}


/*
    通过下面的set delete 我们可以知道 Vue如何去处理哪些数据的修改的

    1. 判断如果是数组类型的
        因为Vue修改了数组上的原型方法 所以当我们通过Vue.set()修改数组的时候  其实就是调用splice方法 其原理跟Obj处理原理差不多
    2. 处理原理 如果是对象 其不需要对对象上其他的属性进行响应式处理 所以直接
        defineReactive(ob.value , key , value);
      然后再通知更新就行  ob.dep.notify();
 */

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * 在对象上设置属性。添加新属性并在属性不存在时触发更改通知。
 * Vue.set(this.name , 'value' , '123')
 * Vue.set(this.arr , 2 , 3)
 */
export function set(target: Array < any > | Object, key: any, val: any): any {
    if (process.env.NODE_ENV !== 'production' &&
        (isUndef(target) || isPrimitive(target))
    ) {
        warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
    }
    // 如果目标对象是数组且 key是一个数组下标类型即正整数
    if (Array.isArray(target) && isValidArrayIndex(key)) {
        // 先设置数组的长度
        target.length = Math.max(target.length, key)
        // 通过splice 插入值
        target.splice(key, 1, val)
        return val
    }
    // 如果存在于 目标对象的 属性 且不是继承的属性
    if (key in target && !(key in Object.prototype)) {
        // 直接赋值
        target[key] = val
        return val
    }
    // 判断是否是 根组件 new Vue({})创建
    // 调用每一个对象上保存的 __ob__ Observer的实例对象
    const ob = (target: any).__ob__
    // 如果是 Vue的实例对象  或者
    if (target._isVue || (ob && ob.vmCount)) {
        process.env.NODE_ENV !== 'production' && warn(
            'Avoid adding reactive properties to a Vue instance or its root $data ' +
            'at runtime - declare it upfront in the data option.'
        )
        return val
    }

    if (!ob) {
        target[key] = val
        return val
    }
    // 将target变成响应式的数据
    // 为什么不用target 而使用obj.value 
    // 因为target是一个新的对象 如果在 target定义响应式的话 那么我们 this.ob.value就不会触发了
    // 而在new Observer的时候 this.value = value 所以target === target.__ob__.value
    // 
    defineReactive(ob.value, key, val)
    //调用 ob.dep 派发更新通知
    ob.dep.notify()
    return val
}

/**
 * Delete a property and trigger change if necessary.
 */

export function del(target: Array < any > | Object, key: any) {
    // 调用Vue.delete()的第一个属性不能为undefined 或者为 基本类型
    if (process.env.NODE_ENV !== 'production' &&
        (isUndef(target) || isPrimitive(target))
    ) {
        warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
    }
    // 如果 第一个参数为数组类型 Vue.delete(this.arr,2) 那么直接调用splice方法
    if (Array.isArray(target) && isValidArrayIndex(key)) {
        target.splice(key, 1)
        return
    }
    //跟set方法一样 先获取其observer对象
    const ob = (target: any).__ob__
    if (target._isVue || (ob && ob.vmCount)) {
        process.env.NODE_ENV !== 'production' && warn(
            'Avoid deleting properties on a Vue instance or its root $data ' +
            '- just set it to null.'
        )
        return
    }
    // 如果 该属性根本不在对象上
    if (!hasOwn(target, key)) {
        return
    }
    // 先删除该属性
    delete target[key]
    if (!ob) {
        return
    }
    // 通知更新
    ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array < any > ) {
    for (let e, i = 0, l = value.length; i < l; i++) {
        e = value[i]
        e && e.__ob__ && e.__ob__.dep.depend()
        if (Array.isArray(e)) {
            dependArray(e)
        }
    }
}