<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Port of upstream motion `dev/react/src/tests/animate-presence-exit-complete-multiple.tsx`
    // @ v14.7.1 (#3233), checked by
    // `packages/framer-motion/cypress/integration/animate-presence-exit-complete-multiple.ts`.
    // e2e/layout-id/exit-complete-once.spec.ts (plan 012).
    //
    // Four boxes, each with its own `AnimatePresence`. A `layout`
    // `layoutId="measurer"` child moves from box to box: when its layout
    // animation completes it moves on, until it reaches the last box. The last
    // box's `onExitComplete` counts into `#done-count`. "start 1" sends the
    // measurer back to box 1, so the last box's child exits exactly once, and
    // the count must read 1, never 2.
    //
    // Deviations: upstream's `Boxes` component resets its index from its
    // `startIndex` prop while rendering; here the click does both. `?owned=true`
    // renders each box's measurer through `present` + `child`.
    //
    // The spec (`@isPlaywright=true`) keeps upstream's default layout
    // transition. A human tester gets a one-second slide per box so each hop
    // can be followed, and a verdict that expects one exit per "start 1" click
    // made while the measurer sits in the last box.

    const params = page.url.searchParams
    const isPlaywright = params.get('@isPlaywright') === 'true'
    const owned = params.get('owned') === 'true'
    const maxNum = 4
    const transition = isPlaywright ? undefined : { duration: 1 }

    let currentIndex = $state(0)
    let doneCount = $state(0)

    const onDone = () => (doneCount += 1)
    const advance = () => {
        if (currentIndex < maxNum - 1) currentIndex += 1
    }
    // Exits the last box should have reported: one per click made while the
    // measurer is in it. A click mid-journey makes no exit from the last box.
    let expected = $state(0)
    const start1 = () => {
        if (currentIndex === maxNum - 1) expected += 1
        currentIndex = 1
    }
    const verdict = $derived(
        doneCount > expected
            ? 'extra'
            : expected === 0
              ? 'waiting'
              : doneCount === expected
                ? 'ok'
                : 'watching'
    )

    const variants = [
        { label: 'clone (default)', query: '' },
        { label: 'owned', query: 'owned=true' }
    ]
    const keep = isPlaywright ? '@isPlaywright=true' : ''
    const variantHref = (query: string) => `?${[keep, query].filter(Boolean).join('&')}`
    const current = owned ? 'owned' : 'clone (default)'

    // Upstream's mount effect: move on from the start box.
    let hydrated = $state(false)
    onMount(() => {
        hydrated = true
        advance()
    })

    const boxStyle =
        'width: 100px; height: 100px; background: aqua; margin-bottom: 20px; position: relative;'
    const measurerStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: '1px solid',
        zIndex: 1
    } as const

    const steps: TesterStep[] = [
        {
            text: 'Load the page and watch the outlined square (the measurer) in the aqua boxes.',
            expected:
                'It slides down one box per second, from box 1 to box 4, and stops in box 4. The count under the boxes reads 0 and the chip reads WAITING.'
        },
        {
            text: 'Once it rests in box 4, click "start 1".',
            expected:
                'It slides from box 4 up to box 2, then down box by box to box 4 again. The count goes to 1 as it leaves box 4, and the chip reads ONCE ✓. The count never jumps by 2.',
            action: { label: 'start 1', run: start1 }
        },
        {
            text: 'Click "start 1" again after each return to box 4, a few times.',
            expected:
                'The count goes up by exactly one per click and the chip stays ONCE ✓. A click before it reaches box 4 sends it back without counting.'
        },
        {
            text: 'Switch to the other variant with the links next to the chip and repeat.',
            expected: 'Both variants behave the same.'
        }
    ]
</script>

<svelte:head>
    <title>layoutId · onExitComplete fires once per exit (#3233)</title>
</svelte:head>

<div>
    {#each Array.from({ length: maxNum }, (_, i) => i) as index (index)}
        <div style={boxStyle}>
            {#if owned}
                <AnimatePresence
                    present={currentIndex === index}
                    onExitComplete={() => index === maxNum - 1 && onDone()}
                >
                    {#snippet child()}
                        <motion.div
                            layout
                            layoutId="measurer"
                            style={measurerStyle}
                            {transition}
                            onLayoutAnimationComplete={advance}
                        />
                    {/snippet}
                </AnimatePresence>
            {:else}
                <AnimatePresence onExitComplete={() => index === maxNum - 1 && onDone()}>
                    {#if currentIndex === index}
                        <motion.div
                            key="measurer"
                            layout
                            layoutId="measurer"
                            style={measurerStyle}
                            {transition}
                            onLayoutAnimationComplete={advance}
                        />
                    {/if}
                </AnimatePresence>
            {/if}
        </div>
    {/each}
</div>
<span id="done-count" data-hydrated={hydrated || undefined}>{doneCount}</span>
<button id="start-1" type="button" onclick={start1}>start 1</button>

<TesterPanel
    eyebrow="Motion 14.7.1 · #3233"
    title="onExitComplete fires once per exit"
    status="Plan 012: each start 1 from box 4 counts exactly one exit, on both syntaxes."
    {steps}
>
    {#snippet summary()}
        <span class="verdict {verdict === 'ok' ? 'ok' : verdict === 'extra' ? 'bad' : 'na'}">
            {verdict === 'ok'
                ? 'ONCE ✓'
                : verdict === 'extra'
                  ? `${doneCount - expected} EXTRA ✗`
                  : verdict === 'watching'
                    ? 'WATCHING'
                    : 'WAITING'}
        </span>
        <span class="readout">box {currentIndex + 1} · exits {doneCount}/{expected}</span>
        <span class="variants">
            {#each variants as v (v.label)}
                {#if v.label === current}
                    <strong>{v.label}</strong>
                {:else}
                    <a href={variantHref(v.query)}>{v.label}</a>
                {/if}
            {/each}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            The measurer's <code>onLayoutAnimationComplete</code> moves it to the next box. The last
            box's <code>AnimatePresence onExitComplete</code> must fire exactly once when the measurer
            leaves it.
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
    .readout {
        margin-left: 0.5rem;
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        color: #475569;
    }
    .variants {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.75rem;
        margin-top: 0.5rem;
        font-size: 0.8rem;
    }
    .variants a {
        color: #2563eb;
        text-decoration: underline;
    }
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
