/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
    warn,
    extend,
    nextTick,
    mergeOptions,
    defineReactive
} from '../util/index'



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