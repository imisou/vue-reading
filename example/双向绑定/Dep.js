// // 其实就是我们 发布订阅者模式中的发布者
// class Dep {
//     subs = [];
//     construtor() {
//         // 所有的订阅者
//         this.subs = []
//     }
//     // 添加一个订阅者
//     addSubs(watcher) {
//         this.subs.push(watcher);
//     }
//     // 取消一个订阅者
//     removeSub(watcher) {
//         if (this.subs.indexOf(watcher) > -1) {
//             this.subs.splice(this.subs.indexOf(watcher), 1);
//         }
//     }
//     // 通知所有的订阅者更新了
//     notify() {
//         const subs = this.subs.slice();
//         for (let i = 0, l = subs.length; i < l; i++) {
//             subs[i].update()
//         }
//     }

//     depend(){
//         // 如果订阅者存在
//         if(Def.target){
//             // 调用订阅者的addDep方法 就是 new Watcher().addDep()
//             Dep.target.addDep(this);
//         }
//     }
// }
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// 其实就是我们 发布订阅者模式中的发布者
var Dep = function () {
    function Dep() {
        _classCallCheck(this, Dep);

        this.subs = [];
    }

    _createClass(Dep, [{
        key: "construtor",
        value: function construtor() {
            // 所有的订阅者
            this.subs = [];
        }
        // 添加一个订阅者

    }, {
        key: "addSubs",
        value: function addSubs(watcher) {
            this.subs.push(watcher);
        }
        // 取消一个订阅者

    }, {
        key: "removeSub",
        value: function removeSub(watcher) {
            if (this.subs.indexOf(watcher) > -1) {
                this.subs.splice(this.subs.indexOf(watcher), 1);
            }
        }
        // 通知所有的订阅者更新了

    }, {
        key: "notify",
        value: function notify() {
            var subs = this.subs.slice();
            for (var i = 0, l = subs.length; i < l; i++) {
                subs[i].update();
            }
        }
    }, {
        key: "depend",
        value: function depend() {
            // 如果订阅者存在
            if (Dep.target) {
                // 调用订阅者的addDep方法 就是 new Watcher().addDep()
                Dep.target.addDep(this);
            }
        }
    }]);

    return Dep;
}();