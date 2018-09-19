<template>
    <div id="app">
        <span :class="{'foo':isFoo}">合并配置</span>
    </div>
</template>

<script>
import Child1 from "./child1"
export default {
    name: 'App',
    components: {

    },
    data(){
        return {
            isFoo : true
        }
    },
    mounted () {
        debugger;
        console.log(this);
    }
}
</script>

<style>
</style>
