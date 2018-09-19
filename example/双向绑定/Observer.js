
function defineReactive(obj, key, val, customSetter, shallow) {
    const dep = new Dep();
    const property = Object.getOwnPropertyDescriptor(obj, key);
    // 不可以
    if (property && property.configurable === false) {
        return
    }
    // 获取 getter
    const getter = property && property.get
    const setter = property && property.set
    if ((!getter || setter) && arguments.length === 2) {
        val = obj[key]
    }

    // let childOb = !shallow && observe(val);
    
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter() {
            const value = getter ? getter.call(obj) : val
            // 当订阅者在触发getter方法之前 就通过Dep.target = this;缓存了此时的订阅者
            // 所以此时Dep.target就是代表 订阅者实例对象
            if (Dep.target) {
                dep.depend()
                // 下面是key是对象或者数组类型的处理
                // if (childOb) {
                //     childOb.dep.depend()
                //     if (Array.isArray(value)) {
                //         dependArray(value)
                //     }
                // }
            }
            return value
        },
        set: function reactiveSetter(newVal) {
            debugger;
            const value = getter ? getter.call(obj) : val
            /* eslint-disable no-self-compare */
            if (newVal === value || (newVal !== newVal && value !== value)) {
                return
            }
            /* eslint-enable no-self-compare */
            // if (process.env.NODE_ENV !== 'production' && customSetter) {
            //     customSetter()
            // }
            if (setter) {
                setter.call(obj, newVal)
            } else {
                val = newVal
            }
            // childOb = !shallow && observe(newVal)
            dep.notify()
        }
    })
}

// 观察者
class Observer {
    value = null
    dep = null
    vmCount = 0
    constructor(value) {
        this.value = value;
        this.dep = new Dep();
        this.vmCount = 0;

        // def(value, "__ob__", this);
        // 如何去处理数组类型的
        
        this.walk(value)
    }
    walk(obj) {
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            defineReactive(obj, keys[i]);
        }
    }
}

"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// 观察者
var Observer = function () {
    function Observer(value) {
        _classCallCheck(this, Observer);

        this.value = null;
        this.dep = null;
        this.vmCount = 0;

        this.value = value;
        // this.dep = new Dep();
        this.vmCount = 0;

        // def(value, "__ob__", this);
        this.walk(value);
    }

    _createClass(Observer, [{
        key: "walk",
        value: function walk(obj) {
            var keys = Object.keys(obj);
            for (var i = 0; i < keys.length; i++) {
                defineReactive(obj, keys[i]);
            }
        }
    }]);

    return Observer;
}();
/*
    如我们有一个 
    data : {
        name : 'gzh',
        age : 23
    }

 */

