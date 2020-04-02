# provide 和 inject

> 在 vue中 是这样定义的 ： 这对选项需要一起使用，以允许一个祖先组件向其所有子孙后代注入一个依赖，不论组件层次有多深，并在起上下游关系成立的时间里始终生效。如果你熟悉 React，这与 React 的上下文特性很相似。

> provide 选项应该是一个对象或返回一个对象的函数。该对象包含可注入其子孙的属性。在该对象中你可以使用 ES2015 Symbols 作为 key，但是只在原生支持 Symbol 和 Reflect.ownKeys 的环境下可工作。

> inject 选项应该是：

- 一个字符串数组，或
- 一个对象，对象的 key 是本地的绑定名，value 是：
  - 在可用的注入内容中搜索用的 key (字符串或 Symbol)，或
  - 一个对象，该对象的：
    - from 属性是在可用的注入内容中搜索用的 key (字符串或 Symbol)
    - default 属性是降级情况下使用的 value


```javascript
// 我们怎么定义provide
provide: {
    "parent": "this is parent"
},
// 或者
provide(){
    return {
      "parent": "this is parent"
    }
},

// 我们这样去定义inject
    inject: {
        parent : 'parent',
        getProvide: {
            from: 'parent',
            default() {
                return 'ceshi'
            }
        },
        getDefault: {
            default() {
                return '这是默认的值'
            }
        }
    },
// 或者这样
inject:['parent'],

```

## 源码实现

### 主要代码路径
1. core/instance/inject.js 定义了provide和inject的赋值处理方式
2. code/util/options.js 定义了provide和inject的多种方式赋值处理与合并策略

### Vue 如何去实现inject和provide的哪？？？

> Vue实现这两个高阶属性其实就3步

#### 1. 处理inject属性，因为inject属性的定义方式很多所以将其统一成{provideKey : { from :'parentProvideKey'}}的形式

Vue 在处理provide和 inject的第一步还是在 vm.$options = mergeOptions( resolveConstructorOptions(vm.constructor) , options || {},vm )这个方法中
```javascript
// 处理inject
normalizeInject(child, vm)
```

```javascript
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
```

#### 2. 进行mergeField合并策略处理

###### 定义了inject 的合并策略
```javascript
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
```
###### 通过 mergeDataOrFn 可见provide属性跟data一样建议使用function的形式并且其可以获取this中的属性

```javascript
strats.provide = mergeDataOrFn
```

3. 进行provide的获取值并存储在_provided属性上；inject进行赋值处理

###### provide 赋值处理就是函数与对象的形式各自处理并将结果保存在vm._provided属性上

```javascript
/**
 * 初试provide属性
 * 如果我们定义provide时函数的形式 执行回调返回结果
 * 如果是对象的形式则直接赋值，并将值存在 _provide中所有我们在initInjections-resolveInject中通过_provided获取provide
 */
export function initProvide (vm: Component) {
    //获取定义的provide
  const provide = vm.$options.provide
  if (provide) {
    // 回调并处理保存在 _provided属性上
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

```

###### 处理inject的赋值
```javascript
/**
 * 初始化 inject 注入
 */
export function initInjections (vm: Component) {
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

export function resolveInject (inject: any, vm: Component): ?Object {
  //如果存在inject
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    // 是否支持symbol
    const keys = hasSymbol
      // 通过Reflect.ownKeys获取所有的属性
      ? Reflect.ownKeys(inject).filter(key => {
        /* istanbul ignore next */
        // 过滤 获取一个新的可枚举的key数组
        return Object.getOwnPropertyDescriptor(inject, key).enumerable
      })
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // 获取 inject : { foo : {from : 'bar',default : 'foo'}}中每一个的from属性
      const provideKey = inject[key].from
      let source = vm
      // 不断向上遍历组件的provide 获取 provide的key与 from相同的属性
      while (source) {

        if (source._provided && hasOwn(source._provided, provideKey)) {
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
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}

```
