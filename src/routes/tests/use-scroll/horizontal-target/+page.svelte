<script lang="ts">
    import { page } from '$app/state'
    import { motion, useMotionValueEvent, useScroll } from '$lib'
    import { onDestroy, onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Port of Motion's `dev/react/src/tests/issue-2546.tsx` @ v14.7.1 (#2546,
    // fixed in `8dce64350`): a horizontal scroller tracking one item with
    // useScroll({ container, target }) and reading scrollXProgress. Before the
    // fix only the `axis` offset ('y' by default) was resolved, so
    // scrollXProgress reported the container's own progress.
    //
    // ?axis=x passes axis: 'x' explicitly (upstream's control: it already
    // worked before the fix).

    const axis = page.url.searchParams.get('axis') as 'x' | 'y' | null

    let containerEl = $state<HTMLElement>()
    let targetEl = $state<HTMLElement>()

    const { scrollXProgress } = useScroll({
        container: () => containerEl,
        target: () => targetEl,
        // Equivalent to ['start end', 'end start'] here (item 5 spans
        // 1000-1200px in a 400px container, so both resolve to [600, 1200]);
        // px keeps it off the native ViewTimeline so the JS `scroll()` path
        // (#2546) is under test.
        offset: ['0px 400px', '200px 0px'],
        ...(axis ? { axis } : {})
    })

    const unsub = useMotionValueEvent(scrollXProgress, 'change', (v) => {
        ;(window as unknown as { __progress?: number }).__progress = v
    })
    onDestroy(unsub)

    // ---- Tester readout ----
    let scrollLeft = $state(0)
    onMount(() => {
        const el = containerEl
        if (!el) return
        const read = () => (scrollLeft = el.scrollLeft)
        el.addEventListener('scroll', read, { passive: true })
        return () => el.removeEventListener('scroll', read)
    })
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    const expected = $derived(clamp((scrollLeft - 600) / 600))
    const tracksTarget = $derived(Math.abs(scrollXProgress.current - expected) <= 0.02)

    const steps: TesterStep[] = [
        {
            text: 'Scroll the grey strip sideways.',
            expected:
                'The blue bar stays empty until the red item enters from the right and is full once it has left on the left.'
        }
    ]
</script>

<svelte:head>
    <title>useScroll horizontal container + target (#2546)</title>
</svelte:head>

<div
    bind:this={containerEl}
    id="container"
    data-testid="container"
    style="width: 400px; height: 200px; overflow-x: scroll; display: flex; position: relative;"
>
    {#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
        {#if i === 5}
            <div
                bind:this={targetEl}
                id="item-{i}"
                style="flex: 0 0 200px; height: 200px; box-sizing: border-box; border-right: 1px solid white; background: red;"
            ></div>
        {:else}
            <div
                id="item-{i}"
                style="flex: 0 0 200px; height: 200px; box-sizing: border-box; border-right: 1px solid white; background: #ccc;"
            ></div>
        {/if}
    {/each}
</div>
<motion.div
    id="bar"
    data-testid="bar"
    style={{ scaleX: scrollXProgress, originX: 0, width: 400, height: 10, background: 'blue' }}
/>
<p>
    accelerated: <span data-testid="accelerated">{String(!!scrollXProgress.accelerate)}</span>
</p>

<TesterPanel
    eyebrow="useScroll · horizontal target (#2546)"
    title="scrollXProgress follows the red item, not the strip"
    status={axis ? `axis: '${axis}'` : 'axis: default'}
    {steps}
>
    {#snippet summary()}
        {#if tracksTarget}
            <span class="verdict ok">TRACKS TARGET ✓</span>
        {:else}
            <span class="verdict bad">TRACKS CONTAINER ✗</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            At scrollLeft <strong>{Math.round(scrollLeft)}</strong> the red item's progress should
            be
            <strong>{expected.toFixed(2)}</strong>; useScroll reports
            <strong>{scrollXProgress.current.toFixed(2)}</strong>.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .verdict {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
</style>
