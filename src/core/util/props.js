/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
    hasOwn,
    isObject,
    toRawType,
    hyphenate,
    capitalize,
    isPlainObject
} from 'shared/util'

type PropOptions = {
    type: Function | Array < Function > | null,
    default: any,
    required: ? boolean,
    validator: ? Function
};


/**
 * 校验数据类型的
 *     key ： 校验的props属性 如 name
 *     propOptions : 待校验的props对象
 *     propsData ： 父组件传递的值
 *     vm ： 当前组件this
 * props : {
 *   name : {
 *     type : Boolean  | [Boolean,String]
 *   }
 * }
 */
export function validateProp(
    key: string,
    propOptions: Object,
    propsData: Object,
    vm ? : Component
): any {
    // 传入的props属性
    const prop = propOptions[key]
    // 父组件没有传递此属性的值
    const absent = !hasOwn(propsData, key)
    // 获取原来的值
    let value = propsData[key]
    // boolean casting
    // 如果 props['name'].type 是否是Boolean类型判断
    const booleanIndex = getTypeIndex(Boolean, prop.type)
    // 数据类型可以为Boolean
    if (booleanIndex > -1) {
        //  父组件没有传递此属性 且没有定义default属性 则默认为false
        if (absent && !hasOwn(prop, 'default')) {
            value = false
        /*
            处理这种情况的props 
            如 name-key= "" 或者 name-key = 'name-key'
            props : {
                nameKey : [Boolean,String]
            }
         */
        } else if (value === '' || value === hyphenate(key)) {
            // only cast empty string / same name to boolean if
            // boolean has higher priority
            // 获取其 type中 String 的下标
            const stringIndex = getTypeIndex(String, prop.type)
            // 不存在String 或者 Boolean在String之前 那么 为true 上述 name-key= "" 或者 name-key = 'name-key' 则 nameKey = true
            if (stringIndex < 0 || booleanIndex < stringIndex) {
                value = true
            }
        }
    }
    // check default value
    // 如果没有传 value 
    if (value === undefined) {
        // 获取default的值
        value = getPropDefaultValue(vm, prop, key)
        // since the default value is a fresh copy,
        // make sure to observe it.
        const prevShouldObserve = shouldObserve
        toggleObserving(true)
        observe(value)
        toggleObserving(prevShouldObserve)
    }
    if (
        process.env.NODE_ENV !== 'production' &&
        // skip validation for weex recycle-list child component props
        !(__WEEX__ && isObject(value) && ('@binding' in value))
    ) {
        assertProp(prop, key, value, vm, absent)
    }
    return value
}

/**
 * Get the default value of a prop.
 */
function getPropDefaultValue(vm: ? Component, prop : PropOptions, key: string): any {
    // no default, return undefined
    // 没有default 属性
    if (!hasOwn(prop, 'default')) {
        return undefined
    }
    // 有default属性
    const def = prop.default
    // warn against non-factory defaults for Object & Array
    // 不能够为Object类型
    if (process.env.NODE_ENV !== 'production' && isObject(def)) {
        warn(
            'Invalid default value for prop "' + key + '": ' +
            'Props with type Object/Array must use a factory function ' +
            'to return the default value.',
            vm
        )
    }
    // the raw prop value was also undefined from previous render,
    // return previous default value to avoid unnecessary watcher trigger
    // 如果父组件没有传递此属性的值，且之前传递过  则使用原来的值
    if (vm && vm.$options.propsData &&
        vm.$options.propsData[key] === undefined &&
        vm._props[key] !== undefined
    ) {
        return vm._props[key]
    }
    // call factory function for non-Function types
    // a value is Function if its prototype is function even across different execution context
    // 如果是函数类型且type 中不包含Function 类型 则回调
    return typeof def === 'function' && getType(prop.type) !== 'Function' ?
        def.call(vm) :
        def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp(
    prop: PropOptions,
    name: string,
    value: any,
    vm: ? Component,
    absent : boolean
) {
    if (prop.required && absent) {
        warn(
            'Missing required prop: "' + name + '"',
            vm
        )
        return
    }
    if (value == null && !prop.required) {
        return
    }
    let type = prop.type
    let valid = !type || type === true
    const expectedTypes = []
    if (type) {
        if (!Array.isArray(type)) {
            type = [type]
        }
        for (let i = 0; i < type.length && !valid; i++) {
            const assertedType = assertType(value, type[i])
            expectedTypes.push(assertedType.expectedType || '')
            valid = assertedType.valid
        }
    }
    if (!valid) {
        warn(
            `Invalid prop: type check failed for prop "${name}".` +
            ` Expected ${expectedTypes.map(capitalize).join(', ')}` +
            `, got ${toRawType(value)}.`,
            vm
        )
        return
    }
    const validator = prop.validator
    if (validator) {
        if (!validator(value)) {
            warn(
                'Invalid prop: custom validator check failed for prop "' + name + '".',
                vm
            )
        }
    }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType(value: any, type: Function): {
    valid: boolean;
    expectedType: string;
} {
    let valid
    const expectedType = getType(type)
    if (simpleCheckRE.test(expectedType)) {
        const t = typeof value
        valid = t === expectedType.toLowerCase()
        // for primitive wrapper objects
        if (!valid && t === 'object') {
            valid = value instanceof type
        }
    } else if (expectedType === 'Object') {
        valid = isPlainObject(value)
    } else if (expectedType === 'Array') {
        valid = Array.isArray(value)
    } else {
        valid = value instanceof type
    }
    return {
        valid,
        expectedType
    }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 * 使用函数字符串名检查内置类型，因为在不同vm / iframes上运行时，简单的等式检查将失败。
 *    Boolean => 'Boolean'
 */
function getType(fn) {
    const match = fn && fn.toString().match(/^\s*function (\w+)/)
    return match ? match[1] : ''
}

function isSameType(a, b) {
    return getType(a) === getType(b)
}

/**
 * 数据类型校验 
 *   getTypeIndex(Boolean,[Boolean,Array])
 *   getTypeIndex(Boolean,Boolean)  
 *     返回下标或者0 没有返回-1 
 */
function getTypeIndex(type, expectedTypes): number {
    // 如果第二个入参不是数组 就直接判断 两个入参数据类型是否相同 
    if (!Array.isArray(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1
    }
    // 第二个入参是数组
    for (let i = 0, len = expectedTypes.length; i < len; i++) {
        // 返回匹配的数据类型的下标 
        if (isSameType(expectedTypes[i], type)) {
            return i
        }
    }
    return -1
}