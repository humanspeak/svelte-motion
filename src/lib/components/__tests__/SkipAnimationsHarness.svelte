<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'

    let { skipAnimations = undefined }: { skipAnimations?: boolean } = $props()
</script>

<MotionConfig {skipAnimations}>
    <MotionContainer
        tag="div"
        initial={{ x: 0 }}
        animate={{ x: 200 }}
        transition={{ duration: 2, ease: 'linear' }}
    />
</MotionConfig>
