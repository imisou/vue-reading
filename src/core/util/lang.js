/* @flow */

/**
 * Check if a string starts with $ or _
 */
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 * 解析简单的路径
 * this.getter.call(vm, vm)
 */
const bailRE = /[^\w.$]/

/**
 * 对于 监听属性 我们监听的属性可能是   'name' 或 'obj.name'
 * @param path
 * @returns {function(*=): *}
 */
export function parsePath (path: string): any {
  //判断格式是否正确
  if (bailRE.test(path)) {
    return
  }
  // 以. 分割
  const segments = path.split('.')
  //  我们对于 getter 后面一般的处理就是 this.getter.call(vm, vm)
  //  那么 此处obj = vm
  return function (obj) {
    //  我们循环遍历
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      //  obj = vm.obj    =>  obj = (vm.obj).name
      obj = obj[segments[i]]
    }
    return obj
  }
}
