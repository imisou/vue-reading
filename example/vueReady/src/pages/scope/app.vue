<template>
    <div id="app">
        <span :class="{'foo':isFoo}">合并配置</span>
        <yz-header>
            <template slot="header">
                <div class="app-header">
                    this is header
                </div>
            </template>
            <div class="app-body">
                this is body
            </div>
        </yz-header>
    </div>
</template>

<script>
import yzHeader from "./yzHeader"
export default {
    name: 'App',
    components: {
        yzHeader
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
