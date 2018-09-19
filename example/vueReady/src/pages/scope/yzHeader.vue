<template>
    <div class="yz-header">
       <div class="header-header">header-header</div>
       <slot name="header"></slot>
       <slot name="default"></slot>
       <!-- <slot name="header"></slot> -->
    </div>
</template>

<script>

export default {
    name: 'yzHeader',
   
    data(){
        return {
            
        }
    },
    mounted () {
       
    }
}
</script>

<style>
</style>
