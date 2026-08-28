<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import { useAnimate } from '$lib/utils/animate.svelte.js'
    import UseAnimateSkipHarness from './UseAnimateSkipHarness.svelte'

    let { skip = false, configuredChild = false }: { skip?: boolean; configuredChild?: boolean } =
        $props()

    const [scope, animate] = useAnimate<HTMLDivElement>()

    const run = () => {
        animate('[data-testid="use-animate-target"]', { opacity: 1 }, { duration: 2 })
    }
</script>

{#if configuredChild}
    <div {@attach scope} data-testid="use-animate-scope">
        <div data-testid="use-animate-target" style="opacity: 0"></div>
        <button type="button" data-testid="run-use-animate" onclick={run}>Run animation</button>
    </div>
{:else}
    <MotionConfig skipAnimations={skip}>
        <UseAnimateSkipHarness {skip} configuredChild />
    </MotionConfig>
{/if}
