/* @flow */

import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
    ASSET_TYPES,
    LIFECYCLE_HOOKS
} from 'shared/constants'

import {
    extend,
    hasOwn,
    camelize,
    toRawType,
    capitalize,
    isBuiltInTag,
    isPlainObject
} from 'shared/util'

/*
    starts这是一个对象，定义了我们在mergeOptions时对各个属性的合并策略
    如
        starts = {
            el :  function(parent,child,vm,key){}   ,           // 其合并策略就是 如果child没有el属性 那么el = parent.el
            propsData :  function(parent,child,vm,key){}   ,    // 其合并策略就是 如果child没有propsData属性 那么propsData = parent.propsData

            // 可以为 函数，然后返回对象(对象进行深拷贝赋值)
            data : function(parent , child , vm) ,      // data属性的合并策略 就是 以child为主体 将child没有的而parent有的都合并到to上面，深度合并
            provide

            // 生命周期 回调函数 的合并策略
            // 其合并策略相同  都是以 父属性为基础数组 ，子属性向父属性数组后面不断的添加。
            // 结果为：  数组中：父属性回到函数在前面  子属性的在后面
            'beforeCreate' : function(parent , child , vm) ,
            'created',
            'beforeMount',
            'mounted',
            'beforeUpdate',
            'updated',
            'beforeDestroy',
            'destroyed',
            'activated',
            'deactivated',
            'errorCaptured'

            // 三个依赖资源的混合策略
            // 以父属性对象 为基本对象，子属性对象复制到父属性对象上。有就覆盖没有就添加（不会深入对象内部)
            'component',
            'directive',
            'filter',

            // 对watch属性的合并，
            // 其注意
            //  1、 Firefox原生watch属性。
            //  2、 其遵循属性本身是一个对象 ，那么就是子属性添加父属性上，
            // 但是与data等不同的是 其每一个属性值为数组，所以每一个属性值按照数组方式合并（父属性的 数组前面，在后面不断添加子属性的）
            watch :  function(parent,child,vm,key){}

            // 这四个其本身就处理后的值就是一个对象 ，而且不需要关注对象下对象的处理，所以就按照一般浅拷贝的方式，有就覆盖没有就添加
            props
            methods
            inject
            computed
        }
 */


/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 * 获取用户自定义的混合策略
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
    // 定义了 options.el 与 options.propsData 两个属性的 合并策略；
    // 即如果child没有el属性 那么el = parent.el ;
    // propsData 相同
    strats.el = strats.propsData = function(parent, child, vm, key) {
        if (!vm) {
            warn(
                `option "${key}" can only be used during instance ` +
                'creation with the `new` keyword.'
            )
        }
        return defaultStrat(parent, child)
    }
}

/**
 * Helper that recursively merges two data objects together.
 * 递归合并两个对象中的所有的属性
 *   以 to 为目标对象  from为源对象 将所有的to上没有而 from上存在的 合并到 to上面
 *   to = {  name : 'to' , obj : { key : 'to-key' }  }
 *   from = { obj : { key : 'from-key',value : 'from-value' } }
 *   结果为 to = { name : 'to' , obj : { key : 'to-key' , value : 'from-value'  } }
 */
function mergeData(to: Object, from: ? Object): Object {
    // 如果 目标对象不存在直接返回原对象
    if (!from) return to
    let key, toVal, fromVal
    // 
    const keys = Object.keys(from)
    for (let i = 0; i < keys.length; i++) {
        key = keys[i]
        toVal = to[key]
        fromVal = from[key]
        // 不是原型上的属性
        if (!hasOwn(to, key)) {
            // 在to对象上绑定或者更新属性，并触发双向绑定通知
            set(to, key, fromVal)
            // 如果仍然是对象 则继续向下遍历合并
        } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
            mergeData(toVal, fromVal)
        }
    }
    return to
}

/**
 * Data
 * 定义了 data/provide 的合并策略
 * 这两个属性的合并策略就是
 *  1、 都支持返回值为函数，但是函数的返回值要为 对象。就是最终结果都是对象的形式
 *  2、 通过mergeData() 定义了对象类型的 合并策略
 */
export function mergeDataOrFn(
    parentVal: any,
    childVal: any,
    vm ? : Component
): ? Function {
    if (!vm) {
        // in a Vue.extend merge, both should be functions
        // 如果 
        if (!childVal) {
            return parentVal
        }
        if (!parentVal) {
            return childVal
        }
        // when parentVal & childVal are both present,
        // we need to return a function that returns the
        // merged result of both functions... no need to
        // check if parentVal is a function here because
        // it has to be a function to pass previous merges.
        return function mergedDataFn() {
            return mergeData(
                typeof childVal === 'function' ? childVal.call(this, this) : childVal,
                typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
            )
        }
    } else {
        return function mergedInstanceDataFn() {
            // instance merge
            // 回调获取 子配置的结果对象
            // 因为data 和 provide 属性都支持返回值为function 类型 所以要执行call
            const instanceData = typeof childVal === 'function' ?
                childVal.call(vm, vm) :
                childVal
            const defaultData = typeof parentVal === 'function' ?
                parentVal.call(vm, vm) :
                parentVal
            //  以 childVal为主体将 parent上的值合并到childVal上
            if (instanceData) {
                return mergeData(instanceData, defaultData)
            } else {
                return defaultData
            }
        }
    }
}

// 定义了 data 属性的混合策略
strats.data = function(
    parentVal: any,
    childVal: any,
    vm ? : Component
): ? Function {
    if (!vm) {
        if (childVal && typeof childVal !== 'function') {
            process.env.NODE_ENV !== 'production' && warn(
                'The "data" option should be a function ' +
                'that returns a per-instance value in component ' +
                'definitions.',
                vm
            )

            return parentVal
        }
        return mergeDataOrFn(parentVal, childVal)
    }

    return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 *
 */
/**
 * 生命周期函数 的合并策略
 * @param parentVal   父配置文件
 * @param childVal    子配置对象
 * @returns {any}     返回的为一个数组
 */
function mergeHook(
    parentVal: ? Array < Function > ,
    childVal : ? Function | ? Array < Function >
) : ? Array < Function > {
    // 可见以父属性为基础数组 ，子属性向父属性数组后面不断的添加
    return childVal ?
        parentVal ?
        parentVal.concat(childVal) :
        Array.isArray(childVal) ?
        childVal : [childVal] : parentVal
}

/*
     定义了生命周期的 默认混合策略
    'beforeCreate' : function(parent , child , vm) ,
    'created',
    'beforeMount',
    'mounted',
    'beforeUpdate',
    'updated',
    'beforeDestroy',
    'destroyed',
    'activated',
    'deactivated',
    'errorCaptured'
 */
// strats.beforeCreate = function(parentVal,childVal){}  结果为 []   
LIFECYCLE_HOOKS.forEach(hook => {
    strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 * 当出现vm(实例创建)时，我们需要在构造函数选项、实例选项和父选项之间进行三种方式的合并。
 */
/**
 * 上面的解释就是  当我们创建一个组件实例的时候
 * 其依赖属性的值一般来至于5个方面。
 *   如 components :
 *      1、  Vue初始化的时候 Vue本身定义的3个组件  components : {  keepAlive ,Transition , TransitionGroup }
 *      2、  Vue.mixin() 全局合并的时候 如果存在components也会合并，但是Vue.mixin的原理也是将全局的合并到 Vue.options.components属性上
 *      3、  Vue.component() 的方式合并，同样 Vue.component()的原理也是将全局的合并到 Vue.options.components属性上。
 *
 *      4、  组件本身定义的extends、mixins两个属性
 *      5、  组件本身定义的components 属性
 *   其合并策略很简单  就是以父属性对象 为基本对象，子属性对象复制到父属性对象上。有就覆盖没有就添加（不会深入对象内部）
 *   其合并顺序也是  1 < (2 | 3 谁后谁大) < 4 < 5 大的覆盖小的
 * @param parentVal
 * @param childVal
 * @param vm
 */
function mergeAssets(
    parentVal: ? Object,
    childVal : ? Object,
    vm ? : Component,
    key : string
) : Object {
    // 以父属性为基础对象
    const res = Object.create(parentVal || null)
    if (childVal) {
        process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
        // 通过extend方式 合并 extend就是一个浅copy 将 childVal的属性复制到res上 （有就覆盖，没有就添加）
        return extend(res, childVal)
    } else {
        return res
    }
}

/*
  定义了 'component','directive', 'filter' 三个属性的混合策略
 */
ASSET_TYPES.forEach(function(type) {
    strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 * 定义了 watch属性的混合策略
 * 其混合策略 以父对象为基础对象，子属性对象不存在就添加 存在 就 返回一个 父属性在前 子属性在后的数组
 */
strats.watch = function(
    parentVal: ? Object,
    childVal : ? Object,
    vm ? : Component,
    key : string
): ? Object {
    // work around Firefox's Object.prototype.watch...
    // 在Firefox浏览器中 对象类型 原型上存在 watch 属性，
    // 所以此处判断是否是 原生的watch属性
    if (parentVal === nativeWatch) parentVal = undefined
    if (childVal === nativeWatch) childVal = undefined
    /* istanbul ignore if */
    if (!childVal) return Object.create(parentVal || null)
    if (process.env.NODE_ENV !== 'production') {
        assertObjectType(key, childVal, vm)
    }
    if (!parentVal) return childVal

    const ret = {}
    // 复制一个 parent的 拷贝对象
    extend(ret, parentVal)

    // 遍历 子对象
    for (const key in childVal) {
        let parent = ret[key]
        const child = childVal[key]
        // 因为 watch属性 的处理函数 可以为 watchKey : [ function1 , function2]
        if (parent && !Array.isArray(parent)) {
            parent = [parent]
        }
        // 其处理方法 跟 生命周期函数的处理方法一样 形成一个新的数组[ parent... , child...]
        ret[key] = parent ?
            parent.concat(child) :
            Array.isArray(child) ? child : [child]
    }
    return ret
}

/**
 * Other object hashes.
 * 这四个其本身就处理后的值就是一个对象 ，而且不需要关注对象下对象的处理，所以就按照一般浅拷贝的方式，有就覆盖没有就添加
 */
strats.props =
    strats.methods =
    strats.inject =
    strats.computed = function(
        parentVal: ? Object,
        childVal : ? Object,
        vm ? : Component,
        key : string
    ): ? Object {
        if (childVal && process.env.NODE_ENV !== 'production') {
            assertObjectType(key, childVal, vm)
        }
        if (!parentVal) return childVal
        const ret = Object.create(null)
        extend(ret, parentVal)
        if (childVal) extend(ret, childVal)
        return ret
    }
//    定义provide 的合并策略 其跟data相同 可以为 函数，然后返回对象
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 * 默认的混合策略
 */
const defaultStrat = function(parentVal: any, childVal: any): any {
    return childVal === undefined ?
        parentVal :
        childVal
}

/**
 * Validate component names
 * 主要是用于校验options.components 每一个子组件名称
 */
function checkComponents(options: Object) {
    for (const key in options.components) {
        validateComponentName(key)
    }
}

/**
 * 检验 组件的名称是否合法 字母加 - 组成， 且不能为系统内置元素名称和config定义的名称
 * @param name
 */
export function validateComponentName(name: string) {
    // 只能为 字母 和 -
    if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        warn(
            'Invalid component name: "' + name + '". Component names ' +
            'can only contain alphanumeric characters and the hyphen, ' +
            'and must start with a letter.'
        )
    }
    // 不能为 内置的元素名称 如 div  , 也不能为配置属性用定义的名称
    if (isBuiltInTag(name) || config.isReservedTag(name)) {
        warn(
            'Do not use built-in or reserved HTML elements as component ' +
            'id: ' + name
        )
    }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
/**
 * 对传入数据中的props进行处理
 *    参考说明文档 我们传入一个props可以有两种方式
 *    {
 *      props : ['value','title','is-active'],
 *      props:{
 *          value : {},
 *          title : []
 *      }
 *    }
 *    这边就是处理将其转换成对象的形式
 *    return
 *    {
 *        value: {type:null},
 *        title: {type:null},
 *        驼峰命名转换
 *        isActive: {type:null},
 *    }
 */
function normalizeProps(options: Object, vm: ? Component) {
    // 获取传入的 props 属性
    const props = options.props
    // 没有 返回
    if (!props) return
    const res = {}
    let i, val, name
    // 如果props是数组
    if (Array.isArray(props)) {
        i = props.length
        while (i--) {
            // 获取每一个属性值
            val = props[i]
            // 如果是字符串
            if (typeof val === 'string') {
                // 将字符串转换成驼峰命名的形式 my-props => myProps
                name = camelize(val)
                // 在 res 存储 属性
                res[name] = { type: null }
            } else if (process.env.NODE_ENV !== 'production') {
                warn('props must be strings when using array syntax.')
            }
        }
        // 如果是简单的对象
    } else if (isPlainObject(props)) {
        // 遍历对象
        for (const key in props) {
            val = props[key]
            // 驼峰命名转换
            name = camelize(key)
            // 判断是否是对象 
            res[name] = isPlainObject(val) ?
                val : { type: val }
        }
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "props": expected an Array or an Object, ` +
            `but got ${toRawType(props)}.`,
            vm
        )
    }
    options.props = res
}

/**
 * Normalize all injections into Object-based format
 * 我们定义inject的方式 有多种
 *   1种 : inject : ['parent','foo'],
 *   2种 : inject : {
 *             parent : 'parent',
 *             parent1 : {
 *                 from : 'parent',
 *                 default(){ return '啊实打实的'}
 *             }
 *         }
 */
function normalizeInject(options: Object, vm: ? Component) {
    //获取配置中的inject属性
    const inject = options.inject
    if (!inject) return
    // 先清空初始化为 {} 
    const normalized = options.inject = {}
    // 如果是数组类型的 inject : ['parent','foo'],
    if (Array.isArray(inject)) {
        //遍历 数组 然后在 normalized 赋值每一个属性 并且将其初始化为对象的形式
        // inject : ['parent','foo'],  => { parent : {from :"parent" }, foo : {from :"foo" }}
        for (let i = 0; i < inject.length; i++) {
            normalized[inject[i]] = { from: inject[i] }
        }
        // 如果是对象类型
    } else if (isPlainObject(inject)) {
        // 遍历对象
        for (const key in inject) {
            const val = inject[key]
            // 如果是对象的形式 就 extend 不是就初始化为  parent : 'parent1' => parent : {from :"parent1" }
            normalized[key] = isPlainObject(val) ?
                extend({ from: key }, val) : { from: val }
        }
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "inject": expected an Array or an Object, ` +
            `but got ${toRawType(inject)}.`,
            vm
        )
    }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives(options: Object) {
    const dirs = options.directives
    if (dirs) {
        for (const key in dirs) {
            const def = dirs[key]
            if (typeof def === 'function') {
                dirs[key] = { bind: def, update: def }
            }
        }
    }
}

function assertObjectType(name: string, value: any, vm: ? Component) {
    if (!isPlainObject(value)) {
        warn(
            `Invalid value for option "${name}": expected an Object, ` +
            `but got ${toRawType(value)}.`,
            vm
        )
    }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 * 合并两个配置对象成一个新的对象，这是组件实例化和继承中一个核心的应用
 */
/*
    对于 Vue.mixin( ... mergeOptions(this.options,mixin)  )来说
        parent : Vue.options 对象
        child  : 用户传入的mixin对象
        vm     : undefined

 */
export function mergeOptions(
    parent: Object,
    child: Object,
    vm ? : Component
): Object {
    // 如果在开发环境 传入的components属性的参数
    // 我们 合并的时候  第一步 校验我们传入的 components 属性名称是否合法
    if (process.env.NODE_ENV !== 'production') {
        checkComponents(child)
    }

    // 判断合并的时候 child 不是对象 而是一个函数
    if (typeof child === 'function') {
        child = child.options
    }

    // 先处理props 转换成对象 并进行驼峰名称处理
    normalizeProps(child, vm)
    // 处理inject 
    normalizeInject(child, vm)
    // 处理directives
    normalizeDirectives(child)

    // 处理extends属性   合并属性 除了mixin还有extends属性
    //
    const extendsFrom = child.extends
    if (extendsFrom) {
        parent = mergeOptions(parent, extendsFrom, vm)
    }

    // 处理mixins
    // 对于 全局的或者组件内部的mixin 我们也可以在minxin内部去定义一个mixins 属性
    // 那么此时我们就需要去处理这个mixin属性
    if (child.mixins) {
        for (let i = 0, l = child.mixins.length; i < l; i++) {
            // 可见我们对于mixins属性  其应该为一个数组
            // { mixins: [ mixin1,mixin2 ... ]  }
            parent = mergeOptions(parent, child.mixins[i], vm)
        }
    }
    const options = {}
    let key
    for (key in parent) {
        mergeField(key)
    }
    for (key in child) {
        if (!hasOwn(parent, key)) {
            mergeField(key)
        }
    }
    // Vue可以通过Vue.config.optionMergeStrategies来自定义混合策略
    function mergeField(key) {
        // 如果用户自定义了混合策略 则使用自定义的 否则使用默认的
        const strat = strats[key] || defaultStrat
        // 使用混合策略去 混合生成 options
        options[key] = strat(parent[key], child[key], vm, key)
    }
    return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 * 使用此函数是因为子实例中需要访问其祖先链中定义的资产
 *
 * 如 我们 需要 components : { child1 , child2 }
 */
export function resolveAsset(
    options: Object,     // 当前组件的 options
    type: string,        // 获取什么类型的资产  components 、
    id: string,          // 资产的唯一标示
    warnMissing ? : boolean
): any {
    /* istanbul ignore if */
    if (typeof id !== 'string') {
        return
    }
    //获取 实例对象 此类型的所有资产
    const assets = options[type]
    // check local registration variations first
    // 如果在 自身属性上存在  直接返回
    if (hasOwn(assets, id)) return assets[id]
    // 将其 进行驼峰命名装换
    const camelizedId = camelize(id)
    // 判断 此时 是否存在
    if (hasOwn(assets, camelizedId)) return assets[camelizedId]
    // 进行首字母大写转换 
    const PascalCaseId = capitalize(camelizedId)
    // 判断是否存在
    if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
    // fallback to prototype chain
    // 如果都不存在 那么就是不存在
    const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
    if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
        warn(
            'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
            options
        )
    }
    return res
}