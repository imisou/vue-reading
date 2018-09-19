/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin(Vue: GlobalAPI) {


    /*
      全局合并策略
        我们一般可能会让所有的组件都拥有一些相同的配置，那么Vue是如何处理的
        在Vue中其存在一个静态属性 options 对象，这就是Vue和VueComponent组件配置信息的一个模板
        一般
        Vue.options = {
            components : {  keepAlive ,Transition , TransitionGroup },
            directives : { },
            filters : {},
            _base : Vue
        },
        那我们以后的的Vue.mixin() Vue.component() Vue.directive() Vue.filters() 都是对Vue的options进行合并处理的

        如此处的Vue.mixin()
     */
    Vue.mixin = function(mixin: Object) {
        // 将 自定义的mixin 合并到Vue.options上  ，
        // 所以我们每一次在初始化 组件的时候 通过
        // Sub.options = mergeOptions(
        //      Super.options,    // Vue.options || VueComponent.options
        //      extendOptions     // 我们在自定义 组件的时候 传入的配置对象
        //   )
        //   就可以将  Vue初试化的时候定义的 几个属性  如 components : { keepAlive ,Transition , TransitionGroup} ;
        //   Vue.mixin({options}) ;
        //   用户定义组件传入的配置； 三者进行一个统一得合并策略进行属性的合并。
        //   总结：
        //    所以 对于像什么el 这种属性的合并 其应该是 Vue自定义的 < Vue.mixin() < 组件mixins < 组件本身配置中的el；
        //    对于 created(){} 这种合并成数组的  其先后顺序应该是 [ Vue自定义的 , Vue.mixin() , 组件mixins ... (后面的在前面的之后) ， 组件本身的 created ]

        this.options = mergeOptions(this.options, mixin)
        return this
    }
}