// class Watcher{
//     // 创建一个订阅者
//     // 在Vue中其实就是我们在vDom中遇到一个{{name}}那就创建一个订阅者
//     // 其一般 key 表示其订阅的是哪一个属性
//     // callback 表示 notify 后的回调函数通知其做什么
//     constructor(vm,key,callback){
//         this.callback = callback;
//         this.vm = vm;
//         this.key = key;
//         // 缓存原来的数据，并通过getter方法来为发布者添加自己这个订阅者
//         this.value = this.get()
//     }

//     // 接收到发布者的通知信息
//     update(){
//         // 更新了什么
//         this.run();
//     }
//     // 就是接收到发布者的通知 进行回调
//     run(){
//         // 获取新的值
//         let value = this.vm.data[this.key];
//         // 获取缓存的原来的值
//         var oldValue = this.value;
//         // 判断是否相同
//         if(value !== oldValue){
//             // 不同就触发更新 ，先将旧值替换成新的值
//             this.value = value;
//             // 然后触发回调函数
//             this.callback.call(this.vm,value,oldValue);
//         }
//     }

//     get(){
//         Dep.target = this;  //先缓存自己
//         var value = this.vm.data[this.key];  //调用data[name]的getter方法
//         return value
//     }

//     addDep(dep){
//         dep.addSubs(this)
//     }
// }

"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Watcher = function () {
    // 创建一个订阅者
    // 在Vue中其实就是我们在vDom中遇到一个{{name}}那就创建一个订阅者
    // 其一般 key 表示其订阅的是哪一个属性
    // callback 表示 notify 后的回调函数通知其做什么
    function Watcher(vm, key, callback) {
        _classCallCheck(this, Watcher);

        this.callback = callback;
        this.vm = vm;
        this.key = key;
        this.value = this.get();
    }

    _createClass(Watcher, [{
        key: "update",
        value: function update() {
            // 更新了什么
            this.callback(this.vm.data[this.key]);
        }
    }, {
        key: "get",
        value: function get() {
            Dep.target = this; //先缓存自己
            var value = this.vm.data[this.key]; //调用data[name]的getter方法
            return value;
        }
    }, {
        key: "addDep",
        value: function addDep(dep) {
            dep.addSubs(this);
        }
    }]);

    return Watcher;
}();