<template>
    <div class="hello">
       
    </div>
</template>

<script>
export default {
    name: 'Props',
    props:{
        name:{
            type:[Boolean,String]
        }
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',

        }
    }
}
</script>
