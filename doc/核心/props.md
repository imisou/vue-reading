# props属性

> Vue 中父组件传值给子组件的方式就是通过props

```javascript
<!--我们定义props的方式-->

props:[name,'isActive'];

props:{
    name : String,
    isActive:{
        type:Boolean, //[ Boolean ]
        default(){
            return false
        },
        required: true
    }

}
```
讲到props就得知道我们定义一个组件的方式
#### 1. Vue构造函数
```javascript
new Vue({
    el : 'app'
})
```
这种方式一般定义根组件所以不会存在props父组件的情况

#### 2. Vue.component()静态方法
```javascript
var buttonCounter =  Vue.component('button-counter', {});
```
最常用的方式 但是其也是调用extend方法去创建一个组件

```javascript
ASSET_TYPES.forEach(type => {
    Vue[type] = function(
        id: string,
        definition: Function | Object
    ): Function | Object | void {
        if (!definition) {
            return this.options[type + 's'][id]
        } else {
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && type === 'component') {
                validateComponentName(id)
            }
            <!--如果是 component -->
            if (type === 'component' && isPlainObject(definition)) {
                <!-- 设置组件的name -->
                definition.name = definition.name || id
                <!-- 调用extend 创建组件 -->
                definition = this.options._base.extend(definition)
            }
            if (type === 'directive' && typeof definition === 'function') {
                definition = { bind: definition, update: definition }
            }
            this.options[type + 's'][id] = definition
            return definition
        }
    }
})
```
#### 3. Vue.extend()静态方法
```javascript
var buttonCounter =  Vue.extend({
    name : 'button-Counter'
});
new buttonCounter().$mounte("#app1")
```











```javascript

```
