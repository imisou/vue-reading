/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
    set,
    del,
    observe,
    defineReactive,
    toggleObserving
} from '../observer/index'

import {
    warn,
    bind,
    noop,
    hasOwn,
    hyphenate,
    isReserved,
    handleError,
    nativeWatch,
    validateProp,
    isPlainObject,
    isServerRendering,
    isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
    enumerable: true,
    configurable: true,
    get: noop,
    set: noop
}

/**
 * 用户访问代理
 *     如  我们 在组件可以通过this.dataKey 访问data对象的每一个属性，但是其实际存储在_data属性上  那么如何做到的
 *     proxy(_data,vm,dataKey)  => 那么我们方位this.dataKey 访问的其实就是 this[sourceKey][key]
 * @param  {[type]} target:    实际访问对象
 * @param  {[type]} sourceKey: 代理对象
 * @param  {[type]} key:       代理的属性
 */
export function proxy(target: Object, sourceKey: string, key: string) {
    sharedPropertyDefinition.get = function proxyGetter() {
        return this[sourceKey][key]
    }
    sharedPropertyDefinition.set = function proxySetter(val) {
        this[sourceKey][key] = val
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}


export function initState(vm: Component) {
    vm._watchers = []
    const opts = vm.$options
    // 初始化 props 属性
    if (opts.props) initProps(vm, opts.props)
    // 处理option中的methods属性 
    if (opts.methods) initMethods(vm, opts.methods)
    // 处理option中的data属性 
    if (opts.data) {
        initData(vm)
    } else {
        // 没有定义data 还是初始化 _data 为一个空的{}
        observe(vm._data = {}, true /* asRootData */ )
    }
    // 处理computed属性
    if (opts.computed) initComputed(vm, opts.computed)
    if (opts.watch && opts.watch !== nativeWatch) {
        initWatch(vm, opts.watch)
    }
}

/**
 * 初始化props属性
 */
function initProps(vm: Component, propsOptions: Object) {
    // 获取父组件编译后传给其的propsData对象
    const propsData = vm.$options.propsData || {}
    // 初始化 _props对象
    const props = vm._props = {}
    // cache prop keys so that future props updates can iterate using Array
    // instead of dynamic object key enumeration.
    const keys = vm.$options._propKeys = []
    // 是否是根组件
    const isRoot = !vm.$parent
    // root instance props should be converted
    if (!isRoot) {
        toggleObserving(false)
    }
    // 遍历props
    for (const key in propsOptions) {
        // 存储 propKey 
        keys.push(key)
        const value = validateProp(key, propsOptions, propsData, vm)
        /* istanbul ignore else */
        if (process.env.NODE_ENV !== 'production') {
            const hyphenatedKey = hyphenate(key)
            if (isReservedAttribute(hyphenatedKey) ||
                config.isReservedAttr(hyphenatedKey)) {
                warn(
                    `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
                    vm
                )
            }
            defineReactive(props, key, value, () => {
                if (vm.$parent && !isUpdatingChildComponent) {
                    warn(
                        `Avoid mutating a prop directly since the value will be ` +
                        `overwritten whenever the parent component re-renders. ` +
                        `Instead, use a data or computed property based on the prop's ` +
                        `value. Prop being mutated: "${key}"`,
                        vm
                    )
                }
            })
        } else {
            defineReactive(props, key, value)
        }
        // static props are already proxied on the component's prototype
        // during Vue.extend(). We only need to proxy props defined at
        // instantiation here.
        if (!(key in vm)) {
            proxy(vm, `_props`, key)
        }
    }
    toggleObserving(true)
}

function initData(vm: Component) {
    // 缓存data属性
    let data = vm.$options.data
    // data属性可以为函数,那么我们data.call(vm,vm) => 可见我们data(vm){} 执行时入参第一个为vm
    data = vm._data = typeof data === 'function' ?
        getData(data, vm) :
        data || {}

    // 不是对象类型的处理
    if (!isPlainObject(data)) {
        data = {}
        process.env.NODE_ENV !== 'production' && warn(
            'data functions should return an object:\n' +
            'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
            vm
        )
    }
    // proxy data on instance  代理数据实例
    // 缓存所有的属性key
    const keys = Object.keys(data)
    // 获取props属性
    const props = vm.$options.props
    // 获取methods
    const methods = vm.$options.methods
    let i = keys.length
    while (i--) {
        // 当前处理的data[key]
        const key = keys[i]
        if (process.env.NODE_ENV !== 'production') {
            // data中属性是否跟methods相同
            if (methods && hasOwn(methods, key)) {
                warn(
                    `Method "${key}" has already been defined as a data property.`,
                    vm
                )
            }
        }
        // 判断是否跟props中相同
        if (props && hasOwn(props, key)) {
            process.env.NODE_ENV !== 'production' && warn(
                `The data property "${key}" is already declared as a prop. ` +
                `Use prop default value instead.`,
                vm
            )
            // 判断属性是否是以 _ 或者 $ 开头
        } else if (!isReserved(key)) {
            // 在vm上的 _data上 定义 此属性
            proxy(vm, `_data`, key)
        }
    }

    // observe data
    // 双向绑定此属性
    observe(data, true /* asRootData */ )
}

export function getData(data: Function, vm: Component): any {
    // #7573 disable dep collection when invoking data getters
    // 在调用数据getter时禁用dep收集
    pushTarget()
    try {
        return data.call(vm, vm)
    } catch (e) {
        handleError(e, vm, `data()`)
        return {}
    } finally {
        popTarget()
    }
}

const computedWatcherOptions = { computed: true }

/*
    计算属性初始化方法
    计算属性的使用方式：
    aDouble: function () {
      return this.a * 2
    },
    // 读取和设置
    aPlus: {
      get: function () {
        return this.a + 1
      },
      set: function (v) {
        this.a = v - 1
      }
    }
 */
function initComputed(vm: Component, computed: Object) {
    // $flow-disable-line
    const watchers = vm._computedWatchers = Object.create(null)
    // computed properties are just getters during SSR
    // 计算属性 在 服务器渲染期间只执行 getter属性
    const isSSR = isServerRendering()

    for (const key in computed) {
        // 定义的每一个属性
        const userDef = computed[key]
        // 计算属性 可以为函数或者对象两种方式
        // 如果为对象，就获取其 get属性
        const getter = typeof userDef === 'function' ? userDef : userDef.get
        if (process.env.NODE_ENV !== 'production' && getter == null) {
            warn(
                `Getter is missing for computed property "${key}".`,
                vm
            )
        }
        // 在非服务器渲染期间 才 定义 订阅者
        if (!isSSR) {
            // create internal watcher for the computed property.
            watchers[key] = new Watcher(
                vm,
                getter || noop,
                noop,
                computedWatcherOptions
            )
        }

        // component-defined computed properties are already defined on the
        // component prototype. We only need to define computed properties defined
        // at instantiation here.
        // 组件定义的计算属性已经在组件原型上定义了。我们只需要定义在实例化时定义的计算属性。
        // 如果定义属性 已经在原型上  如在 data属性 props属性上
        // 或者 是 VueComponent子组件  其在定义的时候就已经 把计算属性 放在原型上  详情见 core/global-api/extend.js extend()
        if (!(key in vm)) {
            // 定义计算属性
            defineComputed(vm, key, userDef)
        } else if (process.env.NODE_ENV !== 'production') {
            if (key in vm.$data) {
                warn(`The computed property "${key}" is already defined in data.`, vm)
            } else if (vm.$options.props && key in vm.$options.props) {
                warn(`The computed property "${key}" is already defined as a prop.`, vm)
            }
        }
    }
}

/**
 * 在vm上 target上定义一个Object.defineProperty 属性  使得我们可以通过 this.computedKey去访问计算属性
 * @param target
 * @param key
 * @param userDef
 */
export function defineComputed(
    target: any,
    key: string,
    userDef: Object | Function
) {
    const shouldCache = !isServerRendering()
    if (typeof userDef === 'function') {
        sharedPropertyDefinition.get = shouldCache ?
            createComputedGetter(key) :
            userDef
        sharedPropertyDefinition.set = noop
    } else {
        sharedPropertyDefinition.get = userDef.get ?
            shouldCache && userDef.cache !== false ?
            createComputedGetter(key) :
            userDef.get :
            noop
        sharedPropertyDefinition.set = userDef.set ?
            userDef.set :
            noop
    }
    if (process.env.NODE_ENV !== 'production' &&
        sharedPropertyDefinition.set === noop) {
        sharedPropertyDefinition.set = function() {
            warn(
                `Computed property "${key}" was assigned to but it has no setter.`,
                this
            )
        }
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 修改我们访问 计算属性的时候 不是通过 userDef()回调就好了，而是触发订阅者的depend()
 * 我们知道  对于计算属性
 *  一方面其是一个发布者 所以 computedWatcher 拥有dep 实例对象
 *      其订阅者 可能为 渲染Watcher 也有可能是其他的计算属性或者监听属性
 *      这一步就是通过 watcher.depend()实现的
 *
 *  另外 其也是一个订阅者 其他发布者数据的更新也需要通知 他，
 *      这一步就是通过warcher.evaluate()实现的 其调用get方法 pushTarget(this)
 *          首先pushTarget(this) 使得 Dep.target指向当前计算Watcher
            然后调用缓存的getter方法 再回调方法中如果计算属性依赖其他响应式数据，
            那么就会触发响应式数据的依赖收集get方法，
            在get方法中调用dep.depend()将此计算Watcher添加到响应式数据的subs中。
 *
 *      返回的值也作为其计算后的值
 *      这就是计算属性的 发布 与 订阅双重对象
 * @param key
 * @returns {computedGetter}
 */
function createComputedGetter(key) {
    return function computedGetter() {
        const watcher = this._computedWatchers && this._computedWatchers[key]
        if (watcher) {
            // 先将渲染watcher 添加到subs中

            watcher.depend()
            return watcher.evaluate()
        }
    }
}


/**
 * 初始化option中的 methods属性
 *  对于methods属性 其最重要的就是 bind(methods[key], vm) 将当前组件对象作为属性this的指向
 * @param vm
 * @param methods
 */
function initMethods(vm: Component, methods: Object) {
    // 获取当前 props属性
    const props = vm.$options.props
    // 遍历 methods
    for (const key in methods) {
        // 在开发环境 判断methods是否名字重复或者名字为空
        if (process.env.NODE_ENV !== 'production') {
            // 不存在
            if (methods[key] == null) {
                warn(
                    `Method "${key}" has an undefined value in the component definition. ` +
                    `Did you reference the function correctly?`,
                    vm
                )
            }
            // 跟props里面定义的属性重名
            if (props && hasOwn(props, key)) {
                warn(
                    `Method "${key}" has already been defined as a prop.`,
                    vm
                )
            }
            // 调用了组件的关键名称如  _data ...
            if ((key in vm) && isReserved(key)) {
                warn(
                    `Method "${key}" conflicts with an existing Vue instance method. ` +
                    `Avoid defining component methods that start with _ or $.`
                )
            }
        }
        //  此处主要 执行bind() 使得我们methods中this的指向为vm
        vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
    }
}

/*
    对于watch属性的处理
    watch: {
        a: function (val, oldVal) {
            console.log('new: %s, old: %s', val, oldVal)
        },
        // 方法名
        b: 'someMethod',
        // 深度 watcher
        c: {
            handler: function (val, oldVal) ,
            deep: true
        },
        // 该回调将会在侦听开始之后被立即调用
        d: {
            handler: function (val, oldVal) ,
            immediate: true,
            sync: true
        },
        e: [
            function handle1 (val, oldVal) ,
            function handle2 (val, oldVal)
        ],
        // watch vm.e.f's value: {g: 5}
        'e.f': function (val, oldVal)
    }
    可见watch的值 可以为 function string obj Array
 */

function initWatch(vm: Component, watch: Object) {
    for (const key in watch) {
        const handler = watch[key]
        if (Array.isArray(handler)) {
            for (let i = 0; i < handler.length; i++) {
                createWatcher(vm, key, handler[i])
            }
        } else {
            createWatcher(vm, key, handler)
        }
    }
}

function createWatcher(
    vm: Component,                    // 当前组件vm
    expOrFn: string | Function,       // watch属性名称
    handler: any,                     // 处理方法
    options ? : Object
) {
    // 处理 为对象的时候 其回调函数 为对象的handler 属性
    if (isPlainObject(handler)) {
        options = handler
        handler = handler.handler
    }
    // 处理  b: 'someMethod'这种情况
    if (typeof handler === 'string') {
        handler = vm[handler]
    }
    // 说明 也是调用的原型上的$watch方法
    // 当前文件最下方
    return vm.$watch(expOrFn, handler, options)
}

export function stateMixin(Vue: Class < Component > ) {
    // flow somehow has problems with directly declared definition object
    // when using Object.defineProperty, so we have to procedurally build up
    // the object here.
    const dataDef = {}
    dataDef.get = function() { return this._data }
    const propsDef = {}
    propsDef.get = function() { return this._props }
    if (process.env.NODE_ENV !== 'production') {
        dataDef.set = function(newData: Object) {
            warn(
                'Avoid replacing instance root $data. ' +
                'Use nested data properties instead.',
                this
            )
        }
        propsDef.set = function() {
            warn(`$props is readonly.`, this)
        }
    }
    Object.defineProperty(Vue.prototype, '$data', dataDef)
    Object.defineProperty(Vue.prototype, '$props', propsDef)

    Vue.prototype.$set = set
    Vue.prototype.$delete = del

    Vue.prototype.$watch = function(
        expOrFn: string | Function,    // watch 的key 即 'watchKey'
        cb: any,                       // watch 的handler 回调
        options ? : Object             // watch的配置对象
    ): Function {
        const vm: Component = this
        // 因为这个是可以在其他地方使用  所以继续判断第二个参数 是否是对象 如果是对象将其处理cb为handler
        if (isPlainObject(cb)) {
            return createWatcher(vm, expOrFn, cb, options)
        }
        options = options || {}
        options.user = true
        // 说明 watch 其也是定义了一个订阅者  { user : true }
        const watcher = new Watcher(vm, expOrFn, cb, options)

        //如果设置了immediate :true 那么立即执行回调
        // d: {
        //     handler: function (val, oldVal){ console.log('d')} ,
        //     immediate: true
        // }
        // 如上面 如果没有设置immediate ：true 那么console.log('d')只有在 watcher 更新的时候触发
        // 如果设置了 immediate ：true 此时立即执行  所以在 初次渲染的时候也会console.log('d')
        if (options.immediate) {
            cb.call(vm, watcher.value)
        }

        // 返回一个清除 依赖的方法
        // this.objWatch = vm.$watch('obj', function(){}, {})
        // 当我们 执行 this.objWatch()的时候将不会再进行 监听watcher
        return function unwatchFn() {
            watcher.teardown()
        }
    }
}