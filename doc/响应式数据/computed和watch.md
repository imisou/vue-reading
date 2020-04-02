# 计算属性 computed

> 对于计算属性其一方面定义了一个响应式的属性，那么说明计算属性是一个Dep发布者对象，另外一方面其通过get，依赖于其他属性数据，那么说明计算属性其也是一个订阅者对象（computedWatcher）

```js
computed: {
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
}
```

## 计算属性的订阅者Watcher的处理

```js
function initComputed(vm: Component, computed: Object) {
	// $flow-disable-line
	const watchers = (vm._computedWatchers = Object.create(null));
	// computed properties are just getters during SSR
	// 计算属性 在 服务器渲染期间只执行 getter属性
	const isSSR = isServerRendering();

	for (const key in computed) {
		// 定义的每一个属性
		const userDef = computed[key];
		// 计算属性 可以为函数或者对象两种方式
		// 如果为对象，就获取其 get属性
		const getter = typeof userDef === 'function' ? userDef : userDef.get;
		if (process.env.NODE_ENV !== 'production' && getter == null) {
			warn(`Getter is missing for computed property "${key}".`, vm);
		}
		// 在非服务器渲染期间 才 定义 订阅者
		if (!isSSR) {
			// create internal watcher for the computed property.
			watchers[key] = new Watcher(vm, getter || noop, noop, computedWatcherOptions);
		}
	}
}
```
在代码中可以看出所有的计算属性都在非服务器渲染期间执行
```js
watchers[key] = new Watcher(vm, getter || noop, noop, computedWatcherOptions);
```
在vm._computedWatchers[key]中保存了当前计算属性的订阅者Watcher对象

其中watcher对象中的 this.computed = true;  this.getter 为计算属性的 get 属性的值。

## 计算属性的响应式处理

计算属性除了是一个订阅者Watcher其也是一个响应式属性，其处理方法在
```js
if (!(key in vm)) {
	// 定义计算属性
	defineComputed(vm, key, userDef);
}


/**
 * 在vm上 target上定义一个Object.defineProperty 属性  使得我们可以通过 this.computedKey去访问计算属性
 * @param target
 * @param key
 * @param userDef
 */
export function defineComputed(target: any, key: string, userDef: Object | Function) {
	const shouldCache = !isServerRendering();
	// 处理第一种定义方式  aDouble: function () { return this.a * 2 }, 其直接是一个函数 只有get方法
	if (typeof userDef === 'function') {
		// 对于非 SSR环境 其需要执行createComputedGetter(key)，即数据的更新需要通知其订阅者的更新，
		sharedPropertyDefinition.get = shouldCache ? createComputedGetter(key) : userDef;
		sharedPropertyDefinition.set = noop;
	} else {
		// 处理第二种方式 计算属性 即存在get 有存在 set
		sharedPropertyDefinition.get = userDef.get
			? shouldCache && userDef.cache !== false
				? createComputedGetter(key)
				: userDef.get
			: noop;
		sharedPropertyDefinition.set = userDef.set ? userDef.set : noop;
	}
	if (process.env.NODE_ENV !== 'production' && sharedPropertyDefinition.set === noop) {
		sharedPropertyDefinition.set = function() {
			warn(`Computed property "${key}" was assigned to but it has no setter.`, this);
		};
	}
	Object.defineProperty(target, key, sharedPropertyDefinition);
}
```

然后我们在看 createComputedGetter(key)

```js
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
		const watcher = this._computedWatchers && this._computedWatchers[key];
		if (watcher) {
			// 先将渲染watcher 添加到subs中

			watcher.depend();
			return watcher.evaluate();
		}
	};
}
```

我们通过 [Vue的响应式数据](http://note.youdao.com/noteshare?id=58ec1158cb120a6e279f827893d22ad3&sub=338812137E674139B0CE36E4A8EE98B7)
可以知道Vue中如何通过其订阅者在调用get方法的时候 先调用数据的get方法，然后再通过Dep.target -> dep.depend -> watcher.addDep -> dep.addSubs 去添加订阅者与发布者的依赖关系

###### 那么计算属性是如何建立这种依赖关系的？

首先我们看计算属性的 new Watcher中的过程，其在
```js
if (this.computed) {
	// 对于计算属性 先让其结果为undefined
	this.value = undefined;
	// 对于 计算属性 其不仅仅是 订阅者 ，他也是一个发布者 所以定义一个 dep
	this.dep = new Dep();
} else {
	// 对于监听Watcher 直接进行get
	this.value = this.get();
}
```
如果是计算属性的时候 不会通过this.get()的方式进行渲染Watcher的 pushTarget() -> this.getter -> vm._render() -> vm.xx.get() -> Dep.depend -> watcher.addDep -> dep.addSubs 的过程，而是本身就创建了一个 dep实例对象

```js
// 对于 计算属性 其不仅仅是 订阅者 ，他也是一个发布者 所以定义一个 dep
this.dep = new Dep();
```
然后在 watcher.depend()的过程中
```js
//watcher.dep()
/**
 * Depend on this watcher. Only for computed property watchers.
 * 只为计算属性 使用的方法
 * 对于渲染Watcher 其使用的是dep.depend()
 */
depend() {
	// 一般 在 调用ComputedGetter的时候 第一次Dep.target执行渲染Watcher
	// TODO: 如果 没有data且computed 没有依赖其他属性 那么Dep.target在初始化时候 什么时候指向渲染Watcher
	if (this.dep && Dep.target) {
		// 所以此时 是将渲染watcher添加到 subs中
		this.dep.depend();
	}
}

// -------------------
// dep.depend()
depend() {
	// Dep.target 指向的是 组件vm._watcher 对象
	if (Dep.target) {
		// 调用Watcher 的addDep方法
		// this 指向  每一个属性 闭包保存的dep实例
		Dep.target.addDep(this);
	}
}
```
在调用watcher.depend()的时候其再调用dep.depend()。

我们知道渲染Watcher与响应式数据建立依赖关系的时候是通过watcher.get() 然后 pushTarget去将渲染Watcher与响应式数据发布者建立起关系的，那么这时候计算属性其响应式功能如何与渲染Watcher建立关系的？上面代码中的Dep.target指向的是什么？

我们知道上面createComputedGetter()是一个高阶函数 其返回的是一个函数，所以在初始化initState的时候是不会执行里面的函数的，只有在通过this.xxx调用的时候才会触发此函数。这时候要么在渲染Watcher执行的时候，这时候已经new Watcher()然后 Dep.target指向渲染Watcher了。所以在执行到this.xx调用get的时候其watcher.depend的 this.dep === 自身这个发布者对象   Dep.target === 当前渲染Watcher环境中渲染Watcher。所以在下一步调用 dep.depend 的时候 Dep.target.addDep(this) 中 Dep.target为渲染Watcher this为 this.dep即计算属性发布者。

**那么刚才 Dep.target 是什么那？ 他就是渲染Watcher 或者 WatchWatcher。**



# 监听属性 watch

> 首先我们知道watch属性的作用，其就像渲染Watcher一样依赖于其他响应式数据的更新从而触发其本身函数的执行。所以我们可以认为其也想渲染Watcher一样也是一个订阅者对象

## 定义的方式

我们知道watch使用的时候方式较多

```js

//对于watch属性的处理
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
```
可见watch的值 可以为 function string obj Array。

那我们再来看watch的源码

```js
function initWatch(vm: Component, watch: Object) {
	for (const key in watch) {
		const handler = watch[key];
		if (Array.isArray(handler)) {
			for (let i = 0; i < handler.length; i++) {
				createWatcher(vm, key, handler[i]);
			}
		} else {
			createWatcher(vm, key, handler);
		}
	}
}

// -------------createWatcher ------------

/**
 * 创建一个watcher对象
 */
function createWatcher(
	vm: Component, // 当前组件vm
	expOrFn: string | Function, // watch属性名称
	handler: any, // 处理方法
	options?: Object
) {
	// 处理 为对象的时候 其回调函数 为对象的handler 属性
	if (isPlainObject(handler)) {
		options = handler;
		handler = handler.handler;
	}
	// 处理  b: 'someMethod'这种情况 其hander回调为 this.hander 这时候应该是methods中的一个属性
	if (typeof handler === 'string') {
		handler = vm[handler];
	}
	// 说明 也是调用的原型上的$watch方法
	// 当前文件最下方
	return vm.$watch(expOrFn, handler, options);
}
```
我们发现其核心还是 通过vm.$watch去处理watch的属性，那么我们回到this.$watch()方法

```js
/**
 *
 * 我们知道watch属性其支持
 * {
 *   immediate: true // 属性
 *   handler: 属性,
 *   deep : Boolean   //是否深度检测--即对于引用类型 其值修改也触发更新
 * }
 */
Vue.prototype.$watch = function(
	expOrFn: string | Function, // watch 的key 即 'watchKey'
	cb: any, // watch 的handler 回调
	options?: Object // watch的配置对象
): Function {
	const vm: Component = this;
	// 因为这个是可以在其他地方使用  所以继续判断第二个参数 是否是对象 如果是对象将其处理cb为handler
	if (isPlainObject(cb)) {
		return createWatcher(vm, expOrFn, cb, options);
	}
	options = options || {};
	//
	options.user = true;
	// 说明 watch 其也是定义了一个订阅者  { user : true }
	const watcher = new Watcher(vm, expOrFn, cb, options);

	//如果设置了immediate :true 那么立即执行回调
	// d: {
	//     handler: function (val, oldVal){ console.log('d')} ,
	//     immediate: true
	// }
	// 如上面 如果没有设置immediate ：true 那么console.log('d')只有在 watcher 更新的时候触发
	// 如果设置了 immediate ：true 此时立即执行  所以在 初次渲染的时候也会console.log('d')
	if (options.immediate) {
		cb.call(vm, watcher.value);
	}

	// 返回一个清除 依赖的方法
	// this.objWatch = vm.$watch('obj', function(){}, {})
	// 当我们 执行 this.objWatch()的时候将不会再进行 监听watcher
	return function unwatchFn() {
		watcher.teardown();
	};
};
```

我们发现其深层逻辑上跟渲染Watcher相差不大，也是通过 pushTarget() -> this.getter -> vm._render() -> vm.xx.get() -> Dep.depend -> watcher.addDep -> dep.addSubs 的过程去创建WatchWatcher订阅者与 响应式数据的 关系。

#### 其区别点在于：

##### 1. 触发响应式属性getter的源头不同。

渲染Watcher与compotedWatcher的一个是 _render()函数执行中 触发 this.xxx,一个是在get执行中触发this.xxx的依赖。

WatchWatcher的依赖发布者对象是确定的 **就是其key值**，所以其this.getter.call()的时候这个getter是有所区别的。

```js
// parse expression for getter
if (typeof expOrFn === 'function') {
    // 如渲染Watcher 与 computedWatcher 其getter都是一个函数，一个是 updateComponent 一个是computed的get属性
	this.getter = expOrFn;
} else {
	// 对于 监听watcher 其 expOrFn 为监听的key 是一个字符串，所以其先要 获取其发布者属性
	// 如 将 obj.name 解析成为 this.getter = function(vm){ vm[obj][name]}
	this.getter = parsePath(expOrFn);
	if (!this.getter) {
		this.getter = function() {};
		process.env.NODE_ENV !== 'production' &&
			warn(
				`Failed watching path: "${expOrFn}" ` +
					'Watcher only accepts simple dot-delimited paths. ' +
					'For full control, use a function instead.',
				vm
			);
	}
}
```
所以其肯定是一个字符串然后执行parsePath(expOrFn) 去将 key转换成 this.getter = function(vm){ vm[obj][name]} 这样一个函数

###### 转换方法如下：

```js
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
```

##### 2. deep属性的支持

```js
/**
 *
 * WatchWatcher的deep深度观察处理
 *   原理就是 判断val的值是否是引用类型，如果是就再深入一层 不断触发每一个属性的 get方法，
 *   然后通过 Dep.target等方式将当前WatchWatcher的 订阅者Watcher实例对象 添加到每一个属性的 subs属性中去
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  // 读取的 vm.obj.a的值了 所以会在执行完后触发 vm.obj.a的get方法
  const isA = Array.isArray(val)
  // 如果是简单类型 直接OK
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // 如果这个是一个响应式对象 那么会进行响应式对象的去重处理
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  // 如果是数组类型
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    // 对象类型处理
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
```
原理就是 判断val的值是否是引用类型，如果是就再深入一层 不断触发每一个属性的 get方法，
 然后通过 Dep.target等方式将当前WatchWatcher的 订阅者Watcher实例对象 添加到每一个属性的 subs属性中去。

 **所以 deep是一个什么损耗性能的方法。**

 ###### 观察属性的移除方法

 在最后提供了一个移除当前设置的监听属性的方法
 ```js
Vue.prototype.$watch = function(
	expOrFn: string | Function, // watch 的key 即 'watchKey'
	cb: any, // watch 的handler 回调
	options?: Object // watch的配置对象
): Function {

	// 返回一个清除 依赖的方法
	// this.objWatch = vm.$watch('obj', function(){}, {})
	// 当我们 执行 this.objWatch()的时候将不会再进行 监听watcher
	return function unwatchFn() {
		watcher.teardown();
	};
};
 ```

 然后我们看

 ```js
/**
 * Remove self from all dependencies' subscriber list.
 */
teardown() {
	if (this.active) {
		// remove self from vm's watcher list
		// this is a somewhat expensive operation so we skip it
		// if the vm is being destroyed.
		if (!this.vm._isBeingDestroyed) {
			remove(this.vm._watchers, this);
		}
		// 调用每一个发布者的removeSub去移除此订阅者
		let i = this.deps.length;
		while (i--) {
			this.deps[i].removeSub(this);
		}
		//将激活属性置位 false
		this.active = false;
	}
}
 ```

 发现其逻辑也很简单就是
 - 一方面设置 watcher的实例属性 active为false。
 - 一方面通过其watcher对象的 deps中存储的其订阅的发布者对象数据，然后调用发布者对象的removeSub方法去移除当前订阅者
