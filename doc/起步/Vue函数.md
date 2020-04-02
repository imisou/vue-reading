# Vue

> 首先我们知道Vue 其实就是一个function，那么在js初始化过程中Vue做了哪些事？

这时候我们就需要从Vue的入口文件开始

###### src/platforms/web/entry-runtime-with-compiler.js

```js
import Vue from './runtime/index'

Vue.prototype.$mount = function(
    el ? : string | Element,
    hydrating ? : boolean
): Component {
}
```

然后我们再看
###### src/platforms/web/runtime/index.js

```js
import Vue from 'core/index'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function
// 在原型上 定义了 __patch__ 方法
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
Vue.prototype.$mount = function(
    el ? : string | Element,
    hydrating ? : boolean
): Component {
}
```


然后我们再看
###### src/core/index.js

```js
import Vue from './instance/index'

initGlobalAPI(Vue)

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

```

然后我们再看
###### src/core/instance/index.js

```js
/**
 * 初始化生成 Vue 全局函数
 * @author guzhanghua
 * @param {*} options
 */
function Vue(options) {
    if (process.env.NODE_ENV !== 'production' &&
        !(this instanceof Vue)
    ) {
        warn('Vue is a constructor and should be called with the `new` keyword')
    }
    this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
```

从上面的 src/core/instance/index.js , src/core/index.js , src/platforms/web/runtime/index.js , src/platforms/web/entry-runtime-with-compiler.js 我们可以知道在Vue初始化的时候主要做了
```
---------------------
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)
------------------------------
initGlobalAPI(Vue)
-----------------------------
定义 Vue.config常量
--------------------------------
// 初始化添加各环境的内置的 directives 和 components
// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)
--------------------------------
定义一些实话方法和属性
Vue.prototype.__patch__
Vue.prototype.$mount
Vue.prototype.$isServer
Vue.prototype.FunctionalRenderContext
```

#### 1. initMixin()

```js
// 定义 实例方法 _init()
export function initMixin(Vue: Class<Component>) {
	Vue.prototype._init = function(options?: Object) {
	};
}
```
#### 2. stateMixin()

```js
export function stateMixin(Vue: Class<Component>) {
	// flow somehow has problems with directly declared definition object
	// when using Object.defineProperty, so we have to procedurally build up
	// the object here.
	// 在Vue内部
	const dataDef = {};
	dataDef.get = function() {
		return this._data;
	};
	const propsDef = {};
	propsDef.get = function() {
		return this._props;
	};
	if (process.env.NODE_ENV !== 'production') {
		dataDef.set = function(newData: Object) {
			warn('Avoid replacing instance root $data. ' + 'Use nested data properties instead.', this);
		};
		propsDef.set = function() {
			warn(`$props is readonly.`, this);
		};
	}
	Object.defineProperty(Vue.prototype, '$data', dataDef);
	Object.defineProperty(Vue.prototype, '$props', propsDef);

	Vue.prototype.$set = set;
	Vue.prototype.$delete = del;

	Vue.prototype.$watch = function(
		expOrFn: string | Function, // watch 的key 即 'watchKey'
		cb: any, // watch 的handler 回调
		options?: Object // watch的配置对象
	): Function {

	};
}
```

#### 3. eventsMixin()

```js
// 定义Vue中 事件相关的实例方法
export function eventsMixin(Vue: Class<Component>) {
	const hookRE = /^hook:/;

	// 监听当前实例上的自定义事件。事件可以由vm.$emit触发。回调函数会接收所有传入事件触发函数的额外参数。
	Vue.prototype.$on = function(event: string | Array<string>, fn: Function): Component {
	};
	// 监听一个自定义事件，但是只触发一次，在第一次触发之后移除监听器。
	Vue.prototype.$once = function(event: string, fn: Function): Component {
	};
	//  移除自定义事件监听器。
	Vue.prototype.$off = function(event?: string | Array<string>, fn?: Function): Component {
	};
	// 触发当前实例上的事件。附加参数都会传给监听器回调。
	Vue.prototype.$emit = function(event: string): Component {
	};
}
```

#### 4. lifecycleMixin()

```js
// 定义Vue中 生命周期相关的 实例方法

export function lifecycleMixin(Vue: Class < Component > ) {
    /*
        可见 _update()方法触发的时机有两种。
        1、 当组件初始化渲染的时候 此时组件从AST -> VNode 但是没有生成DOM元素 此时触发_update 进行 VNode -> DOM的过程
        2、 当组件发生更新的时候  此时响应式数据触发 set方法 然后 dep.notify() 去通知渲染Watcher进行重新getter方法
        此时也会触发 _update() 方法
     */
    Vue.prototype._update = function(vnode: VNode, hydrating ? : boolean) {
    }

    Vue.prototype.$forceUpdate = function() {
    }

    /*
        组件卸载实例方法。在组件卸载钩子函数 data.hook.destory中也是调用此 方法去卸载组件
    */
    Vue.prototype.$destroy = function() {
    }
}
```

#### 5. renderMixin()

```js
// 定义Vue中 组件渲染相关的实例方法
export function renderMixin(Vue: Class<Component>) {
	// install runtime convenience helpers
	// 主要用安装运行时，编译后组件 依赖的一些方法
	/*
        with(this){_c('div',{},[_e()])}
     */
	installRenderHelpers(Vue.prototype);

	Vue.prototype.$nextTick = function(fn: Function) {

	};

	/**
	 * 作用  就是 执行组件上定义的 render函数  生成 一个vnode
	 * @return {vnode} [组件vnode]
	 */
	Vue.prototype._render = function(): VNode {

	};
}
```

#### initGlobalAPI

> 定义Vue的一些静态方法和静态属性

```js
/*
    对于Vue 我们在初始化的时候 会在Vue定义一些静态的属性和方法
    通过console.dir(Vue)
    Vue  ={
        config : {} ,   //这是一个响应式的属性  获取Vue的一些配置信息
        util:{
            warn : function(msg,vm){}  ,   // Vue提供的一个在控制台输出错误信息的方法
            extend : (to , _from ) => {}  ,  // 一个简单的对象合并的公共方法
            mergeOptions : (parent, child , vm) => {}  , // Vue提供的组件option合并的方法
            definedReactive : (obj , key , val , customSetter , shallow ) => {}  // Vue提供的定义响应式数据属性的方法
        },

        // 对Vue属性上响应式数据操作的方法，不能通过Vue.set() ...使用  要通过 this.$set()去设置
        set : (target , key , value ) => {}  ,   // Vue提供的 向一个响应式对象添加一个新的属性，并使新的属性也变成响应式的
        delete : (to , _from ) => {}  ,          // Vue提供的 向一个响应式对象删除一个响应式属性，并移除其所有的订阅者

        // 一个向下一个tick添加回调的方法
        nextTick : (to , _from ) => {}  ,     

        options:{
            components : {

            } ,
            directives : {} ,
            filters : {} ,
            _base : Vue                // 指向当前的大Vue 提供一个Vue的基类构造器
        }   

    }
 */
export function initGlobalAPI(Vue: GlobalAPI) {
    // config
    const configDef = {}
    configDef.get = () => config
    if (process.env.NODE_ENV !== 'production') {
        configDef.set = () => {
            warn(
                'Do not replace the Vue.config object, set individual fields instead.'
            )
        }
    }
    Object.defineProperty(Vue, 'config', configDef)

    // exposed util methods.
    // NOTE: these are not considered part of the public API - avoid relying on
    // them unless you are aware of the risk.
    Vue.util = {
        warn,
        extend,    
        mergeOptions,
        defineReactive
    }

    //定义了一个公共的方法
    Vue.set = set
    Vue.delete = del
    Vue.nextTick = nextTick

    Vue.options = Object.create(null)
    ASSET_TYPES.forEach(type => {
        Vue.options[type + 's'] = Object.create(null)
    })

    // this is used to identify the "base" constructor to extend all plain-object
    // components with in Weex's multi-instance scenarios.
    Vue.options._base = Vue

    //  扩展Vue 的全局组件
    extend(Vue.options.components, builtInComponents)

    //  定义Vue.use() 方法
    initUse(Vue)

    // 定义Vue.mixin() 方法
    initMixin(Vue)
    // 定义Vue.extend() 方法
    initExtend(Vue)

    // 定义Vue.component() Vue.directive() Vue.filter() 3个全局静态方法
    initAssetRegisters(Vue)
}

```


## Vue的整体流程

大方向上可以分为两个部分
##### 1. 编译部分
##### 2. 执行部分

### 在编译部分主要分为3步：

1. 将HTML 转换成 AST 对象

```js
const ast = parse(template.trim(), options)
```

2. 标记静态节点、静态根节点

```js
if (options.optimize !== false) {
    optimize(ast, options)
}
```

3. codegen 把AST树转换成 代码执行字符串

```js
const code = generate(ast, options)
```

### 执行部分主要分为

#### 1. Vue的初始化过程

在这个过程主要做的是定义

##### 一些静态属性
- config
- options  
- version
- util

##### 一些静态方法

- set
- delete
- nextTick
- use
- mixin
- extend
- component
- directive
- filter

##### 一些实例属性

- $isServer
- $ssrContext
- FunctionalRenderContext
- $data
- $props
- $set
- $delete
- $watch
- _events
- _hasHookEvent

##### 一些实例方法

- $mount
- \_\_patch\_\_
- _init
- $on
- $once
- $off
- $emit
- _update
- $forceUpdate
- $destroy
- $nextTick
- _render

----------- installRenderHelpers(Vue.prototype) -------------------

- _o
- _n
- _s
- _l
- _t
- _q
- _i
- _m
- _f
- _k
- _b
- _v
- _e
- _u
- _g



#### 2. 组件的_init()过程

主要做的工作是

- options的合并策略
- 生命周期的初始化
- 事件的处理
- 渲染有关属性和方法的处理 及 slot的处理
- 回调beforeCreate生命周期函数
- 处理属性 包含高阶属性 inject 、provide 和响应式属性 data、props、computed、methods
- 触发 created 生命周期钩子函数


#### 3. 组件渲染的过程

主要做的工作是

- 触发 beforeMount 生命周期钩子函数
- 通过初始化渲染Watcher进行组件render函数的执行将编译期间的 可执行的代码字符串变成 vnode
- 通过_update 和 __patch__ 将vnode转换成 html
- ???????????????????
- 然后触发 mounted 生命周期钩子函数


#### 4. 数据更新过程



```
Vue.prototype = {
    // ------------  区分构造函数参数  --------------
    // 两个实例属性表明此组件实例是通过Vue构造函数还是 VueComponent构造函数创建的
    _isVue : Boolean,
    _isComponent : Boolean,

    // -----------------------------------------
    // 组件的mergeOptions合并后的配置属性
    $options : {
        _parentListeners : {} ,  //

    },

    //--------  组件树相关的参数     -------------
    $root : vm ,  // 根组件实例对象
    $parent : vm, // 父组件实例对象
    $children : [ vm , vm] , // 子组件实例对象

    //---------- ref 实现的相关参数  --------------
    $refs : {  } ,    // 存放该组件下的所有的 ref 对象

    //-------- render 渲染相关的参数 -------------
    _vode : nulll ,
    $vnode :  null ,
    _staticTrees : null ,

    $options : {
        _parentVnode : null ,
    },

    _c : (a, b, c, d) => createElement(vm, a, b, c, d, false) ,
    $createElement :  (a, b, c, d) => createElement(vm, a, b, c, d, true),

    //-------- slot 相关的参数 -------------
    $slots : {} ,
    $scopedSlots : {}


    //------- provide , inject 相关的参数 ---------
    _provided : function ,

    $options:{
         provide : {},
         inject : {}
    },

    //-------- 响应式数据相关的参数 ----------------
    _watchers : [] ,
    _data : {},

    $options : {
        data:{},
        props:{},
        methods:{},
        computed:{},
        watch : {}
    }
}

```
