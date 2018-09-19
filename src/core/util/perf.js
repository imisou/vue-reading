import { inBrowser } from './env'

export let mark
export let measure

// 如果不是生产环境
if (process.env.NODE_ENV !== 'production') {
    // 判断是否是浏览器环境，且支持performance
    const perf = inBrowser && window.performance
    /* istanbul ignore if */
    if (
        perf &&
        perf.mark &&
        perf.measure &&
        perf.clearMarks &&
        perf.clearMeasures
    ) {
        mark = tag => perf.mark(tag)
        measure = (name, startTag, endTag) => {
            perf.measure(name, startTag, endTag)
            perf.clearMarks(startTag)
            perf.clearMarks(endTag)
            perf.clearMeasures(name)
        }
    }
}