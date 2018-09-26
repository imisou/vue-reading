/* @flow */

/**
 * Runtime helper for rendering static trees.
 */
/**
    编译的时候对于静态根节点生成的表达式字符串函数

    如 
    <div v-for="item in arr" :key="item.id">
        <div>
            <p>xxxxx:</p>
        </div>
    </div>  

    _l(arr, function(item) {
		return _c("div", { key: item.id }, [_m(1, true)])
	}),

    code = {
        staticRenderFns: [
            1 : "with(this){return _c('div',[_c('p',[_v("xxxxx:")])])}"
        ]
    }


 * @param {*} code.staticRenderFns 的下标
 * @param {*} 静态根节点是否在 v-for 循环下 
 */
export function renderStatic(
    index: number,
    isInFor: boolean
): VNode | Array < VNode > {
    // 将 非v-for节点下的 静态根节点缓存到 组件实例对象 _staticTrees属性上
    const cached = this._staticTrees || (this._staticTrees = [])
    let tree = cached[index]
        // if has already-rendered static tree and not inside v-for,
        // we can reuse the same tree.
    if (tree && !isInFor) {
        return tree
    }
    // otherwise, render a fresh tree.
    // 调用其表达式字符串 生成 vnode 并缓存到this._staticTrees上
    tree = cached[index] = this.$options.staticRenderFns[index].call(
        this._renderProxy,
        null,
        this // for render fns generated for functional component templates
    )

    // 将vnode 的属性 isStatic key isOnce 3个属性
    markStatic(tree, `__static__${index}`, false)
    return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 * 实际上，这意味着用唯一的键将节点标记为静态。
 */

/**
 * 
   处理 v-for 节点下的 v-once 节点
    <div v-for="item in arr" :key="item.id">
      <div v-once>
        <p>xxxxx:</p>
      </div>   
    </div>

    generate 转换 
    _l(arr, function(item) {
			return _c("div", { key: item.id }, [
				_o(_c("div", [_c("p", [_v("xxxxx:")])]), 0, item.id)
			])
		})
    结果 就是把v-once 的vnode对象上
    {
        isStatic : true,
        key : __once__${state.onceId}_${key},
        isOnce : true,
    }


    注意：
        对于其他的如 一般的 v-once节点 直接按照静态根节点处理

 * @param {*} tree   vnode 节点
 * @param {*} index  当前 state.onceId++
 * @param {*} key    v-for循环的 key 的值
 */
export function markOnce(
    tree: VNode | Array < VNode > ,
    index: number,
    key: string
) {

    // 调用标记为静态节点方法     __once__0_${item_id}
    markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
    return tree
}



function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {

    /*
        什么时候是数组？

        v-once 与 v-for 在同一个节点上  那么其按照 _m(3)的方式进行处理
        <div v-for="item in arr" :key="item.id" v-once>
            <div >
                <p>xxxxx:</p>
            </div>
        </div>

        with(this){return _l((arr),function(item){return _c('div',{key:item.id},[_m(2,true)])})}

        其返回的vnode就是一个vnode数组

     */
  if (Array.isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        //   其 key 为 "__static__${code.staticRenderFns.index}_${i}"
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    //   对于 markOnce 肯定不是数组类型 
    markStaticNode(tree, key, isOnce)
  }
}

/**
 * 修改vnode 节点的 isStatic key isOnce 3个属性
 * @param {*} node 
 * @param {*} key 
 * @param {*} isOnce 
 */
function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}