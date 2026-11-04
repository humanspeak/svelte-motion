<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import { untrack } from 'svelte'
    import { type AnimationScope, useAnimate } from '$lib/utils/animate.svelte.js'
    import type { SvelteMotionAnimate } from '$lib/utils/animateValue.js'
    import UseAnimateConfigHarness from './UseAnimateConfigHarness.svelte'

    let {
        reducedMotion,
        skip,
        onScope,
        onAnimate,
        configuredChild = false
    }: {
        reducedMotion?: 'always' | 'never' | 'user'
        skip?: boolean
        onScope?: (scope: AnimationScope<HTMLDivElement>) => void
        onAnimate?: (animate: SvelteMotionAnimate) => void
        configuredChild?: boolean
    } = $props()

    // Called in both branches (hooks can't be conditional at init), but only the
    // inner instance, the one inside MotionConfig, hands its scope and animate
    // to the test.
    const [scope, animate] = useAnimate<HTMLDivElement>()

    // Once, at init: the test captures them and reads the live values itself.
    untrack(() => {
        if (configuredChild) {
            onScope?.(scope)
            onAnimate?.(animate)
        }
    })

    const run = () => {
        animate('[data-testid="box"]', { x: 100, opacity: 1 }, { duration: 2 })
    }
</script>

{#if configuredChild}
    <div {@attach scope} data-testid="scope">
        <div data-testid="box" style="opacity: 0"></div>
        <button type="button" data-testid="run-x" onclick={run}>Run x</button>
    </div>
{:else}
    <MotionConfig {reducedMotion} skipAnimations={skip}>
        <UseAnimateConfigHarness configuredChild {onScope} {onAnimate} />
    </MotionConfig>
{/if}
