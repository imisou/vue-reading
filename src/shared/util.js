/* @flow */
// 创建一个空的冻结的对象，不能够修改
export const emptyObject = Object.freeze({})

// these helpers produces better vm code in JS engines due to their
// explicitness and function inlining
// 检测是否是 空类型
export function isUndef (v: any): boolean %checks {
  return v === undefined || v === null
}
// 检测是否不是空
export function isDef (v: any): boolean %checks {
  return v !== undefined && v !== null
}

export function isTrue (v: any): boolean %checks {
  return v === true
}

export function isFalse (v: any): boolean %checks {
  return v === false
}

/**
 * Check if value is primitive
 * 检测是否是基本数据类型
 */
export function isPrimitive (value: any): boolean %checks {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    // $flow-disable-line
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  )
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 * 检测是否是引用类型（复杂数据类型）
 */
export function isObject (obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object'
}

/**
 * Get the raw type string of a value e.g. [object Object]
 */
const _toString = Object.prototype.toString

// 主要用于检测数据类型的  通过Object.prototype.toString.call(value)    [object Array][object Function]...
export function toRawType (value: any): string {
  // 返回值的数据类型  String,Number,Boolean,Undefined,Null,Symbol,Object,Array,Function,RegExp,Date
  return _toString.call(value).slice(8, -1)
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 * 检测是否是简单的对象类型
 */
export function isPlainObject (obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}
//  检测是否是正则类型
export function isRegExp (v: any): boolean {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 * 检测是否是数组的下标
 */
export function isValidArrayIndex (val: any): boolean {
  const n = parseFloat(String(val))
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

/**
 * Convert a value to a string that is actually rendered.
 */
export function toString (val: any): string {
  return val == null
    ? ''
    : typeof val === 'object'
      ? JSON.stringify(val, null, 2)
      : String(val)
}

/**
 * Convert a input value to a number for persistence.
 * If the conversion fails, return original string.
 */
export function toNumber (val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * 生成一个检测值是否是其中一个的检测函数
 *   如：  const isBuildInTag = makeMap('slot,component', true)
 *            return function(val){{slot:true,component:true}[val] }
 *    入参 ： 
 *       str : 生成map的字符串以,隔开， 如'slot,component',   'key,ref,slot,slot-scope,is'
 *       expectsLowerCase : 检测是否存在的时候是否区分大小写
 *   出参：  返回一个检测函数
 */  
export function makeMap (
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | void {
  // 创建一个空的对象  Object.create(null)，不会存在__proto__
  const map = Object.create(null)
  // 将str以,装换成数组
  const list: Array<string> = str.split(',')
  // 遍历数组生成Map对象
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  // 根据expectsLowerCase ： true则 不区分大小写  false：区分大小写
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}

/**
 * Check if a tag is a built-in tag.
 * 判断元素是否是 内置元素 不区分大小写
 */
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if a attribute is a reserved attribute.
 * 判断属性是否是预留的属性  区分大小写
 */
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * Remove an item from an array
 * 从一个数组中去除指定的第一个元素，判断规则为 === 
 */
export function remove (arr: Array<any>, item: any): Array<any> | void {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * Check whether the object has the property.
 * 缓存hasOwnProperty方法，为什么？
 *    这是一个继承的公共方法，当多次使用的时候请缓存成局部方法，不然每次都通过原型查找，性能更慢。
 */
const hasOwnProperty = Object.prototype.hasOwnProperty

// 判断是否是本身的属性方法，如对象的toString方法就是继承方法
//   hasOwn({},'toString')   =>  false
export function hasOwn (obj: Object | Array<*>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 *  对于一些函数，缓存其结果
 *  如下面的驼峰命名转换
 *    其入参为 (str) => { return str.replace(/-(+\w)/g, (_,c)=> c ? c.toUpperCase() : '')}
 */
export function cached<F: Function> (fn: F): F {
  // 首先其穿件一个空的对象{}
  const cache = Object.create(null)
  // 返回一个函数 当入参 camelize('my-name')
  return (function cachedFn (str: string) {
    // 以入参为key 获取缓存对象上是否存在
    const hit = cache[str]
    // 存在则返回 没有则执行函数并且将其结果作为新的一个属性值
    return hit || (cache[str] = fn(str))
  }: any)
}

/**
 * Camelize a hyphen-delimited string.
 *  将字符串按照驼峰命名转换，并且缓存其结果
 *      camelize('my-name') => 'myName';
 */
const camelizeRE = /-(\w)/g
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 * Capitalize a string.
 * 首字母大写
 */
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 * 将驼峰命名转换成 - 的形式  与camelize正好相反
 * 
 */
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * Simple bind polyfill for environments that do not support it... e.g.
 * PhantomJS 1.x. Technically we don't need this anymore since native bind is
 * now more performant in most browsers, but removing it would be breaking for
 * code that was able to run in PhantomJS 1.x, so this must be kept for
 * backwards compatibility.
 */

/* istanbul ignore next */
// 在Vue中我们methods中所有的函数的this都指向组件本身，而不是 function 就是使用了fun.bind(this)
// 但是在有些运行环境中不支持此 方法，就需要自定义
function polyfillBind (fn: Function, ctx: Object): Function {
  function boundFn (a) {
    const l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }

  boundFn._length = fn.length
  return boundFn
}
// 原生的bind方法
function nativeBind (fn: Function, ctx: Object): Function {
  return fn.bind(ctx)
}
// bind 判断是否存在bind如果存在则用原生的不存在则使用 自定义的
export const bind = Function.prototype.bind
  ? nativeBind
  : polyfillBind

/**
 * Convert an Array-like object to a real Array.
 * 将类数组转换成真正的数组
 */
export function toArray (list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * Mix properties into target object.
 * 对象的继承
 */
export function extend (to: Object, _from: ?Object): Object {
  // 遍历from对象 忽略非自身属性方法
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 * 数组转对象
 */
export function toObject (arr: Array<any>): Object {
  const res = {}
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/)
 * 创建一个空的函数
 */
export function noop (a?: any, b?: any, c?: any) {}

/**
 * Always return false.
 */
export const no = (a?: any, b?: any, c?: any) => false

/**
 * Return same value
 */
export const identity = (_: any) => _

/**
 * Generate a static keys string from compiler modules.
 */
export function genStaticKeys (modules: Array<ModuleOptions>): string {
  return modules.reduce((keys, m) => {
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
export function looseEqual (a: any, b: any): boolean {
  if (a === b) return true
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  if (isObjectA && isObjectB) {
    try {
      const isArrayA = Array.isArray(a)
      const isArrayB = Array.isArray(b)
      if (isArrayA && isArrayB) {
        return a.length === b.length && a.every((e, i) => {
          return looseEqual(e, b[i])
        })
      } else if (!isArrayA && !isArrayB) {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        return keysA.length === keysB.length && keysA.every(key => {
          return looseEqual(a[key], b[key])
        })
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

export function looseIndexOf (arr: Array<mixed>, val: mixed): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
export function once (fn: Function): Function {
  let called = false
  return function () {
    if (!called) {
      called = true
      fn.apply(this, arguments)
    }
  }
}
