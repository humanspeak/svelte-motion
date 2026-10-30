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

    const owned = page.url.searchParams.get('owned') === 'true'
    const maxNum = 4

    let currentIndex = $state(0)
    let doneCount = $state(0)

    const onDone = () => (doneCount += 1)
    const advance = () => {
        if (currentIndex < maxNum - 1) currentIndex += 1
    }
    const start1 = () => {
        currentIndex = 1
    }

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
            text: 'Wait two seconds after the page loads.',
            expected:
                'The outlined measurer slides down from box 1 to the last box and stops there. The count reads 0.'
        },
        {
            text: 'Click "start 1".',
            expected:
                'The measurer jumps back up to box 2 and slides down again to the last box. The count reads 1, and never 2.',
            action: { label: 'start 1', run: start1 }
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
    status="Plan 012: the count reads 1 after start 1 on both syntaxes."
    {steps}
>
    {#snippet summary()}
        <span class="verdict {doneCount === 1 ? 'ok' : doneCount > 1 ? 'bad' : 'na'}">
            {doneCount === 1 ? 'ONCE ✓' : doneCount > 1 ? `${doneCount}× ✗` : 'WAITING'}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            The measurer's <code>onLayoutAnimationComplete</code> moves it to the next box. The last
            box's <code>AnimatePresence onExitComplete</code> must fire exactly once when the measurer
            leaves it.
        </p>
        <p>Variants: <a href="?owned=true">owned</a> · <a href="?">clone (default)</a></p>
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
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
