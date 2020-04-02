####  组件的更新过程

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Index</title>
</head>

<body>
    <div id="app">
        <button-counter :count="count"></button-counter>
        <button @click="addCounter">addCounter</button>
    </div>
</body>
<script type="text/javascript" src="../vue.js"></script>
<script type="text/javascript">
var buttonCounter = Vue.component('button-counter', {
    name: "buttonCounter",
    props: {
        count: [String, Number]
    },
    data: function() {
        return {

        }
    },
    template: `
        <div class="child">{{count}}</div>
    `
})
var vue = new Vue({
    name: "App",
    el: "#app",
    components: {
        buttonCounter
    },
    data: function() {
        return {
            count: 0
        }
    },
    methods: {
        addCounter:function() {
            this.count++;
        }
    }
})
</script>

</html>
```
上面是一个很简单的栗子，当我们点击触发addCounter的时候 this.count的值重新赋值就会触发
this.data的set方法，然后通知到当前组件（App组件）的updateComponent()

```js
new Watcher(vm, updateComponent, noop, {
    // 在我们的更新队列中 其更新方法 是sort排列 使得 子组件在父组件之后更新
    // 先调用before 然后调用 watcher.run()方法
    before() {
        if (vm._isMounted) {
            callHook(vm, 'beforeUpdate')
        }
    }
}, true /* isRenderWatcher */ )
```

然后触发第一步触发 vm.render() 进行组件AST -> VNode的重新生成
```js
vm._update(vm._render(), hydrating)
```
然后触发 vm._update()方法
