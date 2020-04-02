# Vue中是如何设计响应式数据的

> 我们用data这个属性进行理解Vue的响应式的原理，其采用的是数据劫持结合发布-订阅者模式实现的，首先我们先简单了解一下发布-订阅者模式

## 发布-订阅者模式

发布-订阅者模式依赖两个对象 ，一个发布者、一个订阅者。

###### 发布者需要做的什么事？

- 提供一个实例对象存放订阅它的所有订阅者对象
- 提供一个添加、删除订阅者的方法
- 提供一个给所有订阅者发布消息的方法

###### 订阅者

- 需要接受发布者发送的消息

```js
class Dep {
    constructor(name){
        // 初始化的时候提供发布者名称
        this.name = name;
        // 上面核心的功能 提供一个实例对象保存所有的订阅它的订阅者数据
        this.observers = [];
    }

    // 提供添加订阅者的方法  --没有做订阅者重复添加的处理
    addObserver(observer){
        this.observers.push(observer);
    }

    //提供删除订阅者的方法
    removeObserver(observer){
        this.observers.splice(this.observers.indexOf(observer))
    }

    // 提供一个给所有订阅者发布消息的方法
    notify(state){
        this.observers.forEach(item => item.update(state , this))
    }
}

class Observer {
    constructor(name){
        this.name = name;
    }

    // 需要接受发布者发送的消息
    update(state , dep){
        console.log(`${this.name}接收到${dep.name}发送了一条消息${state}`);
    }
}

var dep1 = new Dep('新华报社');

var zs = new Observer('张三');
var ls = new Observer('李四');

dep1.addObserver(zs);
dep1.addObserver(ls);

dep1.notify('发送消息了');
```

在Vue中所有的Watch就是就是一个订阅者，其订阅了data等响应式数据的更新，所以每一个数据的更新就像上面的发布者一样 通过notify去通知所有的订阅者Watch，但是根据上面的方式存在一个问题：**所有的Watch都需要data响应式数据去添加订阅者，那么data又怎么知道谁订阅了他了？**

那么这时候我们就需要去修改他了--这时候就需要借助数据劫持

```js
class Dep {
    constructor(name){
        // 初始化的时候提供发布者名称
        this.name = name;
        // 上面核心的功能 提供一个实例对象保存所有的订阅它的订阅者数据
        this.observers = [];
    }

    // 提供添加订阅者的方法  --没有做订阅者重复添加的处理
    addObserver(observer){
        this.observers.push(observer);
    }

    //提供删除订阅者的方法
    removeObserver(observer){
        this.observers.splice(this.observers.indexOf(observer))
    }

    // 提供一个给所有订阅者发布消息的方法
    notify(state){
        this.observers.forEach(item => item.update(state , this))
    }
}

// 继续改造发布者对象 借助于对象的静态属性是共享的
Dep.target = null;


const targetStack = [];

// 提供一个存放target的方法，这时候这个target就是订阅者
function pushTarget( _target){
    // 如果存在值 那么说明这时候已经有订阅者请求订阅了
    if(Dep.target){
        //
        targetStack.push(Dep.target)
    }
    Dep.target = _target
}

function popTarget() {
	Dep.target = targetStack.pop();
}


class Observer {
    getter : Function;
    value : any;

    constructor(name , expOrFn){
        this.name = name;
        if(typeof expOrFn === 'function'){
            this.getter = expOrFn;
        }else{
            // 对于 监听watcher 其 expOrFn 为监听的key 是一个字符串，所以其先要 获取其发布者属性
			// 如 将 obj.name 解析成为 this.getter = function(vm){ vm[obj][name]}
			this.getter = parsePath(expOrFn);
        }
        this.value = this.get();
    }

    // 触发数据劫持中的get方法，并将当前Watcher传过去
    get(){
        // 先调用pushTarget 将当前订阅者实例对象存放在 发布者的静态属性上
        pushTarget(this);
        //做些其他的事
        // 我们拿渲染Watcher来举例，
        // 在渲染Watcher中getter = updateComponent() 那么这时候就会触发组件内 vm._render()这时候如果在vnode中存在任何一个响应式属性，那么这时候就会触发这个响应式属性的 get方法，而这时候 Dep.target === 当前Watcher
        this.value = this.getter.call(vm , vm)

        //将target移除
        popTarget()
    }

    // 需要接受发布者发送的消息
    update(state , dep){
        console.log(`${this.name}接收到${dep.name}发送了一条消息${state}`);
    }
}

```

然后我们再看Vue对响应式数据的处理

```js
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
export function observe(value: any, asRootData: ?boolean): Observer | void {
	if (!isObject(value) || value instanceof VNode) {
		return;
	}
	// 申明一个 观察者
	let ob: Observer | void;
	// 判断这个属性是否已经 被 绑定过
	if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
		ob = value.__ob__;
	} else if (
		shouldObserve &&
		!isServerRendering() &&
		(Array.isArray(value) || isPlainObject(value)) &&
		Object.isExtensible(value) &&
		!value._isVue
	) {
		// 初始化一个观察者对象
		ob = new Observer(value);
	}

	if (asRootData && ob) {
		ob.vmCount++;
	}
	return ob;
}

```
从这一步我们看出其首先是将这个响应式对象通过 new Observer(value)进行处理，但是我们一般的data里面肯定会存在子属性也是对象的，那么这个怎么处理的，这时候我们我看看这个 Observer 观察者对象

```js
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
		this.value = value;
		// 定义了一个 发布者的实例
		this.dep = new Dep();
		// TODO: vmCount的作用
		this.vmCount = 0;
		// 1. 将ob server实例保存在 data.__ob__属性上
		// 2. 可见每一个组件对于data就一个observer实例对象  其保存在_data.__ob__属性上
		// 变成不可枚举  所以 walk的时候 defineReactive不会变成响应
		def(value, '__ob__', this);

		// 对数据类型的数据进行处理
		// 如 data(){ return [1,2,3,4]}
		if (Array.isArray(value)) {
			// 我们访问数组 其上面保存了数组的原型数据
			const augment = hasProto ? protoAugment : copyAugment;
			// 如果存在 __proto__ 那么就将修改的方法放在其原型链上
			// 如果没有就直接存在数组对象上
			augment(value, arrayMethods, arrayKeys);
			this.observeArray(value);
		} else {
			// 其他类型进行处理
			this.walk(value);
		}
	}

	/**
	 * Walk through each property and convert them into
	 * getter/setters. This method should only be called when
	 * value type is Object.
	 */
	walk(obj: Object) {
		// 使对象上的每一个属性变成响应式的
		const keys = Object.keys(obj);
		for (let i = 0; i < keys.length; i++) {
			defineReactive(obj, keys[i]);
		}
	}

	/**
	 * Observe a list of Array items.
	 */
	observeArray(items: Array<any>) {
		for (let i = 0, l = items.length; i < l; i++) {
			// 使数组中的每一个值变成响应式的
			observe(items[i]);
		}
	}
}

```
在对于对象类型的处理是通过 this.walk()去遍历每一个属性，然后通过 defineReactive(obj , keys[i])去处理每一个对象属性

这时候我们就需要去看看defineReactive

```js
/**
 * Define a reactive property on an Object.
 * 将data|props|computed中的某一个属性借助Object.defineProperty()变成响应式
 */
export function defineReactive(
	obj: Object, // 处理的是哪一个对象
	key: string, // 处理的是obj 上的哪一个属性
	val: any, // 其初始值
	customSetter?: ?Function,
	shallow?: boolean // 是否判断子属性是否为对象，false则判断
) {
	// 定义一个发布者实例
	// 使得每一个属性 都变成一个发布者 那么此属性修改了就可以通过dep.notify去通知其订阅者
	const dep = new Dep();

	// 获取data上此属性的属性描述对象
	const property = Object.getOwnPropertyDescriptor(obj, key);
	if (property && property.configurable === false) {
		return;
	}

	// cater for pre-defined getter/setters
	// 缓存原来此属性上的 get/set方法
	const getter = property && property.get;
	const setter = property && property.set;
	if ((!getter || setter) && arguments.length === 2) {
		val = obj[key];
	}

	// 如果此属性还是对象继续向下遍历
	let childOb = !shallow && observe(val);
	Object.defineProperty(obj, key, {
		enumerable: true,
		configurable: true,
		// 依赖收集
		// 记得我们 如果 访问 this.name.obj.xx 其会依次触发 this.name的get 然后this.name.obj的get ..
		get: function reactiveGetter() {
			const value = getter ? getter.call(obj) : val;
			// 在我们 mountComponent的时候 我们 new Watcher()
			// 此时  调用了pushTarget 使得当前 Dep的静态属性 target指向 组件的 _watcher 对象
			// 那么我们在 render() 函数 转 vnode 时候 访问 某一个属性的时候就会触发此属性的
			// get 方法
			//
			// 此时 Dep.target 指向 正在处理的组件实例的 _watcher 对象
			if (Dep.target) {
				// 调用每一个属性上的 dep实例
				dep.depend();
				// TODO: 为什么需要 childOb
				if (childOb) {
					childOb.dep.depend();
					if (Array.isArray(value)) {
						dependArray(value);
					}
				}
			}
			return value;
		},
		// 派发更新
		// 当我们 在代码中使用 this.dataKey = '12312';将触发dataKey的set方法
		set: function reactiveSetter(newVal) {
			//如果我们在data的时候定义了 此属性的getter方法  那么我们就需要执行getter方法获取正确的新值
			const value = getter ? getter.call(obj) : val;
			/* eslint-disable no-self-compare */
			// 如果 新值与旧值相同  就不处理了
			if (newVal === value || (newVal !== newVal && value !== value)) {
				return;
			}
			/* eslint-enable no-self-compare */
			if (process.env.NODE_ENV !== 'production' && customSetter) {
				// 定义了公共的setter方法
				customSetter();
			}
			// 定义了setter方法  那么就需要调用一下setter方法
			if (setter) {
				setter.call(obj, newVal);
			} else {
				val = newVal;
			}
			childOb = !shallow && observe(newVal);
			// 通知订阅者更新
			dep.notify();
		}
	});
}
```
阅读此段代码 发现 defineReactive 的主要作用是将对象的每一个属性变成响应式的，其在get 和 set 对象属性的时候就会触发此 get set方法。

那么连接我们上面所说的我们在 Watcher对象初始化的时候 调用了 this.getter方法 然后触发 vm._render()方法这时候就会调用每一个响应式属性的get方法

```js
get: function reactiveGetter() {
	const value = getter ? getter.call(obj) : val;
	// 在我们 mountComponent的时候 我们 new Watcher()
	// 此时  调用了pushTarget 使得当前 Dep的静态属性 target指向 组件的 _watcher 对象
	// 那么我们在 render() 函数 转 vnode 时候 访问 某一个属性的时候就会触发此属性的
	// get 方法
	//
	// 此时 Dep.target 指向 正在处理的组件实例的 _watcher 对象
	if (Dep.target) {
		// 调用每一个属性上的 dep实例
		dep.depend();
		// TODO: 为什么需要 childOb
		if (childOb) {
			childOb.dep.depend();
			if (Array.isArray(value)) {
				dependArray(value);
			}
		}
	}
	return value;
}
```

这时候我们再看这个get方法。

首先他会先调用 getter ? getter.call() : val； 为什么？

因为Vue中的响应式不止存在于 data， computed属性其也是响应式的，那么这个computed属性的每一个属性 既可以定义自己的get方法。如果我们不调用执行以下getter方法，那么computed属性的get就没有意义了。

下面才是最重要的 if(Dep.target){} 我们知道在new Watcher()的时候会在触发 getter的时候即进行 pushTarget()将当前Watcher存放在  Dep.target属性上，那么这时候我们就可以通过 Dep.target 知道是哪一个订阅者(Watcher)需要订阅此发布者对象。

然后我们再继续看 dep.depend();

```js
depend() {
	// Dep.target 指向的是 组件vm._watcher 对象
	if (Dep.target) {
		// 调用Watcher 的addDep方法
		// this 指向  每一个属性 闭包保存的dep实例
		Dep.target.addDep(this);
	}
}
```

Dep.taregt === Watcher  那就是调用 watcher的 addDep(this)

```js
/**
 * Add a dependency to this directive.
 * dep  ：  每一个属性上通过 闭包 缓存的 此属性的dep实例
 */
addDep(dep: Dep) {
	// 当前组件 订阅的 发布者(Dep)对象
	const id = dep.id;
	// 如果这个 wather 上已经 保存
	if (!this.newDepIds.has(id)) {
		this.newDepIds.add(id);
		this.newDeps.push(dep);
		if (!this.depIds.has(id)) {
			// 调用发布者 添加 此订阅者
			dep.addSub(this);
		}
	}
}
```

可以看出对于每一个

###### 发布者Dep

其可以通过 subs去查看自己被哪些Watcher所订阅了。

###### 对于订阅者 Watcher

- 通过 newDepIds去知道其订阅了哪些发布者，保存了发布者实例对象的id
- 通过 newDeps 去知道其订阅了哪些发布者，保存了发布者实例对象

通过上面我们知道了Vue是如何让那些订阅者Watcher被它所依赖的发布者Dep对象添加到订阅者数据subs中去的。那么Vue又是如何在响应式数据更新的时候去及时的通知其订阅者Watcher的啦。

#### 数据的更新

我们一般修改一个数据 对于Object.defineProperty()就会触发其set方法，那么数据更新的入口就是definedReactive()的set方法

```js
set: function reactiveSetter(newVal) {
	//如果我们在data的时候定义了 此属性的getter方法  那么我们就需要执行getter方法获取正确的新值
	const value = getter ? getter.call(obj) : val;
	/* eslint-disable no-self-compare */
	// 如果 新值与旧值相同  就不处理了
	if (newVal === value || (newVal !== newVal && value !== value)) {
		return;
	}
	/* eslint-enable no-self-compare */
	if (process.env.NODE_ENV !== 'production' && customSetter) {
		// 定义了公共的setter方法
		customSetter();
	}
	// 定义了setter方法  那么就需要调用一下setter方法
	if (setter) {
		setter.call(obj, newVal);
	} else {
		val = newVal;
	}
	childOb = !shallow && observe(newVal);
	// 通知订阅者更新
	dep.notify();
}
```

核心的就是最后一步  dep.notify();

```js
// 提供发布者通知订阅者更新的方法
notify() {
	// stabilize the subscriber list first
	const subs = this.subs.slice();
	for (let i = 0, l = subs.length; i < l; i++) {
		// 调用每一个订阅者update方法  其实就是watcher的update方法
		subs[i].update();
	}
}
```

这时候就需要上面的 this.subs中保存的所有订阅了其的订阅者对象了,然后遍历数组调用每一个订阅者对象的update方法。

这边跟一般的发布-订阅者模式有区别的是，一般的发布-订阅者模式其在调用订阅者的update的时候都会传递一个消息过去，如报社的新闻数据等。而这边不需要。

```js
/**
 * Subscriber interface.
 * Will be called when a dependency changes.
 * 当响应式数据更新 发布者调用此方法来通知订阅者更新
 */
update() {
	/* istanbul ignore else */
	if (this.computed) {
		// A computed property watcher has two modes: lazy and activated.
		// It initializes as lazy by default, and only becomes activated when
		// it is depended on by at least one subscriber, which is typically
		// another computed property or a component's render function.
		if (this.dep.subs.length === 0) {
			// In lazy mode, we don't want to perform computations until necessary,
			// so we simply mark the watcher as dirty. The actual computation is
			// performed just-in-time in this.evaluate() when the computed property
			// is accessed.
			this.dirty = true;
		} else {
			// In activated mode, we want to proactively perform the computation
			// but only notify our subscribers when the value has indeed changed.
			this.getAndInvoke(() => {
				this.dep.notify();
			});
		}
	} else if (this.sync) {
		this.run();
	} else {
		queueWatcher(this);
	}
}
```

看订阅者接收到数据更新的处理过程。

一般我们都是data属性数据 所以先从 queueWatcher()开始

```js
/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher(watcher: Watcher) {
    const id = watcher.id
    // 所有的watcher 保存在has的属性上
    if (has[id] == null) {
        has[id] = true
        // 没有触发 更新通知
        if (!flushing) {
            queue.push(watcher)
        } else {
            // if already flushing, splice the watcher based on its id
            // if already past its id, it will be run next immediately.
            let i = queue.length - 1
            while (i > index && queue[i].id > watcher.id) {
                i--
            }
            queue.splice(i + 1, 0, watcher)
        }
        // queue the flush
        if (!waiting) {
            waiting = true
            nextTick(flushSchedulerQueue)
        }
    }
}

```
我们发现其是通过一个 watcher的队列去处理所有的Watcher 这样就解决了我们在大批量的修改数据的时候造成渲染Watcher的不断更新问题。 具体有关Vue对于渲染队列处理的问题请看

- [ ] 渲染队列处理的问题

#### 总结

通过上面的流程我们知道Vue对于响应式数据 主要依赖于3个对象 一个Observer对象、一个Dep对象、一个Watcher对象

在initState的时候通过observe() 去判断这个属性有没有变成响应式的，如果变成响应式的就在根对象上存在 \_\_ob\_\_ 属性,如果没有就通过 new Observer() 将其变成一个观察者对象，然后在初始化Observer的过程中通过defineReactive() 将所有的属性变成响应式的。

其中在defineReactive()的过程中也对每一个属性通过闭包的方法创建一个发布者对象，即var dep = new Dep();  这样每一个响应式属性都存在一个 dep发布者实例对象 、一个 get、set方法。

对于订阅者对象Watcher，

其一方面在组件mountComponent()的时候创建一个渲染Watcher对象，然后通过 this.get() 去调用渲染Watcher的 updateComponent方法并执行 vm._render()从而触发响应式属性的get，在此之前通过Dep.target静态属性解决发布订阅者模式中需要发布者添加订阅者的问题。然后通过 dep.depend() watcher.addDep() dep.addSubs()的相互调用使得发布者-订阅者都各自保存了一份相互的引用

- dep 的 subs数组 保存发布者被订阅者的所有订阅者数据
- wathcer 的 newDepIds数组 保存订阅者订阅的所有发布者的id
- wathcer 的 newDepIds数组 保存订阅者订阅的所有发布者
- watcher 的 depIds数组 ？？？？

对于数据更新的过程其在数据更新的时候触发响应式数据的set方法，然后在set方法中调用 dep.notify()去调用所有的订阅者对象的 watcher.update()方法。然后在update的时候通过 watcherQueue队列去处理Watcher的更新问题
