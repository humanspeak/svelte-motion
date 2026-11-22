<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { ReducedMotionConfig } from '$lib/types.js'

    let {
        reducedMotion = undefined,
        animateX = 200
    }: { reducedMotion?: ReducedMotionConfig; animateX?: number } = $props()
</script>

<MotionConfig {reducedMotion}>
    <MotionContainer
        tag="div"
        initial={{ x: 0, opacity: 0 }}
        animate={{ x: animateX, opacity: 1 }}
        transition={{ duration: 2, ease: 'linear' }}
    />
</MotionConfig>
