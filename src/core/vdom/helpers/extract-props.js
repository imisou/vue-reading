/* @flow */

import {
  tip,
  hasOwn,
  isDef,
  isUndef,
  hyphenate,
  formatComponentName
} from 'core/util/index'

/*
  HTML 中的特性名是大小写不敏感的，所以浏览器会把所有大写字符解释为小写字符。
  这意味着当你使用 DOM 中的模板时，camelCase (驼峰命名法) 的 prop 名需要使用其等价的 kebab-case (短横线分隔命名) 命名
 */
/**
 * 主要用于提前子组件 依赖的 props
 * 我们正常创建组件的方式  h(App,{ .... },[])
 *  其中我们会定义父子传值  props
 * @param data
 * @param Ctor
 * @param tag
 */
export function extractPropsFromVNodeData (
  data: VNodeData,
  Ctor: Class<Component>,
  tag?: string
): ?Object {

  // we are only extracting raw values here.
  // validation and default values are handled in the child
  // component itself.
  //  因为在 处理父组件传给子组件 props之前 我们已经在Ctor = baseCtor.extend(Ctor)  （即core/gloabl-api/extend.js）的时候就对子组件props属性进行处理
  //  所以我们此处可以获取子组件需要哪些 数据
  const propOptions = Ctor.options.props
  if (isUndef(propOptions)) {
    return
  }
  const res = {}
  // 说明子组件props 与 占位符VNode(父组件)对应的属性为attrs、props
  const { attrs, props } = data

  if (isDef(attrs) || isDef(props)) {
    for (const key in propOptions) {
      //  camelCase (驼峰命名法) 的 prop 名需要使用其等价的 kebab-case (短横线分隔命名) 命名
      //  对子组件依赖的props进行 驼峰命名转  kebab-case (短横线分隔命名)
      const altKey = hyphenate(key)
      if (process.env.NODE_ENV !== 'production') {
        const keyInLowerCase = key.toLowerCase()
        if (
          key !== keyInLowerCase &&
          attrs && hasOwn(attrs, keyInLowerCase)
        ) {
          tip(
            `Prop "${keyInLowerCase}" is passed to component ` +
            `${formatComponentName(tag || Ctor)}, but the declared prop name is` +
            ` "${key}". ` +
            `Note that HTML attributes are case-insensitive and camelCased ` +
            `props need to use their kebab-case equivalents when using in-DOM ` +
            `templates. You should probably use "${altKey}" instead of "${key}".`
          )
        }
      }
      // 校验
      checkProp(res, props, key, altKey, true) ||
      checkProp(res, attrs, key, altKey, false)
    }
  }
  return res
}

/**
 *
 * @param res          一个用于保存 的对象 {}
 * @param hash         子组件依赖的属性 在props上 还是 attrs
 * @param key          子组件依赖的属性名称
 * @param altKey       在父组件上 此依赖的名称
 * @param preserve
 * @returns {boolean}
 */
function checkProp (
  res: Object,
  hash: ?Object,
  key: string,
  altKey: string,
  preserve: boolean
): boolean {
  if (isDef(hash)) {
    if (hasOwn(hash, key)) {
      res[key] = hash[key]
      if (!preserve) {
        delete hash[key]
      }
      return true
    } else if (hasOwn(hash, altKey)) {
      res[key] = hash[altKey]
      if (!preserve) {
        delete hash[altKey]
      }
      return true
    }
  }
  return false
}
