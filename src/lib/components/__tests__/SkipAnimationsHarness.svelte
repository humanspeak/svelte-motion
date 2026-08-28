<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { MotionTransition } from '$lib/types.js'

    let {
        skipAnimations = undefined,
        animateX = 200,
        parentTransition = undefined,
        transition = undefined
    }: {
        skipAnimations?: boolean
        animateX?: number
        parentTransition?: MotionTransition
        transition?: MotionTransition
    } = $props()
</script>

{#snippet configuredChild()}
    {@const config = getMotionConfig()}
    <span data-testid="transition-probe" data-transition={JSON.stringify(config?.transition)}
    ></span>
    <MotionContainer
        tag="div"
        initial={{ x: 0 }}
        animate={{ x: animateX }}
        transition={{ duration: 2, ease: 'linear' }}
    />
{/snippet}

<MotionConfig transition={parentTransition} {skipAnimations}>
    <MotionConfig {transition}>
        {@render configuredChild()}
    </MotionConfig>
</MotionConfig>
