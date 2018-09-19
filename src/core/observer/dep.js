/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
    // 全局target 表明同一时间只能有一个watcher在处理  那么我们就可以通过Dep.watcher去访问当前处理的watcher对象
    static target: ? Watcher;
    // 每一个 发布者 其唯一id
    id: number;
    // 保存了 订阅了该发布者的所有观察者对象
    subs: Array < Watcher > ;

    constructor() {
        // 组件上每一个响应式属性  都 生成一个对应的发布者 
        // 每一个发布者唯一id，用来在 订阅者 在订阅发布者的时候判断是否已经订阅过此订阅者
        this.id = uid++;
        // 保存所有的订阅者对象， 当数据更新的时候调用notify 通知订阅者更新
        this.subs = []
    }

    // 发布者  添加一个订阅者(这里就是 Watcher)
    addSub(sub: Watcher) {
        this.subs.push(sub)
    }

    removeSub(sub: Watcher) {
        remove(this.subs, sub)
    }

    depend() {
        // Dep.target 指向的是 组件vm._watcher 对象
        if (Dep.target) {
            // 调用Watcher 的addDep方法
            // this 指向  每一个属性 闭包保存的dep实例
            Dep.target.addDep(this)
        }
    }
    // 提供发布者通知订阅者更新的方法
    notify() {
        // stabilize the subscriber list first
        const subs = this.subs.slice()
        for (let i = 0, l = subs.length; i < l; i++) {
            // 调用每一个订阅者update方法  其实就是watcher的update方法 
            subs[i].update()
        }
    }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// 存储了当前处理的watcher 对象
Dep.target = null
// 当我们处理父子组件的时候 我们先执行 父组件的mountComponent()  此时Dep.target = 父watcher 
// 然后执行到子组件 此时 Dep.target 存在 先将其存放在targetStack栈中，
// 然后发现没有子组件了 popTarget()从栈中获取当前的target
const targetStack = []

export function pushTarget(_target: ? Watcher) {
    if (Dep.target) targetStack.push(Dep.target)
    Dep.target = _target
}

export function popTarget() {
    Dep.target = targetStack.pop()
}