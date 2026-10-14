<script lang="ts">
    import { LayoutGroup, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Layout elements stay accelerated at rest (Motion 14.2). Driven by
     * `e2e/independent-transforms/layout-idle.spec.ts`.
     *
     * Every box runs the same `x` entry animation, which Motion 14.2 composes
     * into one accelerated WAAPI `transform` animation. Nothing on the page
     * changes layout after mount, so the `layout`, `layoutDependency` and
     * grouped `layoutId` boxes must stay on the compositor like the control.
     * Upstream's `MeasureLayout` calls `willUpdate()` only on updates
     * (`getSnapshotBeforeUpdate`), never on mount (framer-motion
     * `motion/features/layout/MeasureLayout.tsx` @ `v14.2.0`); a mount-time
     * `willUpdate()` would demote the transforms to the main thread.
     */
    const transition = { duration: 1, ease: 'linear' } as const

    const box = {
        width: '100px',
        height: '50px',
        background: '#0077ff'
    }

    /** Ids of the four fixture boxes, in render order. */
    const ids = ['layout', 'layout-dependency', 'layout-id', 'control']

    /**
     * Counts the running animations on `#id` whose keyframes animate
     * `transform`. Same body as upstream's `window.countTransformAnimations`.
     */
    const countTransformAnimations = (id: string) =>
        document
            .getElementById(id)!
            .getAnimations()
            .filter((animation) =>
                (animation.effect as KeyframeEffect)
                    .getKeyframes()
                    .some((keyframe) => 'transform' in keyframe)
            ).length

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    const sampleTimes = [150, 450, 800]
    let isTester = $state(false)
    let samples = $state<Record<string, number[]>>({})

    const sampleAll = () => {
        for (const id of ids) {
            samples[id] = [...(samples[id] ?? []), countTransformAnimations(id)]
        }
    }

    onMount(() => {
        ;(window as unknown as Record<string, unknown>).countTransformAnimations =
            countTransformAnimations
        isTester = !window.location.search.includes('@isPlaywright=true')

        const timers = isTester ? sampleTimes.map((time) => setTimeout(sampleAll, time)) : []
        return () => timers.forEach(clearTimeout)
    })

    const verdict = (id: string) => {
        const seen = samples[id]
        if (!seen || seen.length < sampleTimes.length) return null
        return seen.every((count) => count === 1)
    }

    const steps: TesterStep[] = [
        {
            text: 'Reload the page and watch the four blue boxes in the top-left corner for one second.',
            expected:
                'Every box slides 100px right at the same steady pace; none of them changes size. The verdict list reads PASS for all four.',
            action: { label: 'Reload', run: () => window.location.reload() }
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms — layout elements at rest</title>
</svelte:head>

<div class="fixture">
    <motion.div id="layout" layout style={box} animate={{ x: 100 }} {transition} />
    <motion.div
        id="layout-dependency"
        layout
        layoutDependency={0}
        style={box}
        animate={{ x: 100 }}
        {transition}
    />
    <LayoutGroup>
        <motion.div
            id="layout-id"
            layoutId="idle-shared"
            style={box}
            animate={{ x: 100 }}
            {transition}
        />
    </LayoutGroup>
    <motion.div id="control" style={box} animate={{ x: 100 }} {transition} />
</div>

<TesterPanel
    eyebrow="framer-motion MeasureLayout.tsx (mount vs update)"
    title="Layout elements stay accelerated at rest"
    status="Expected on Chromium with Motion 14.2: every row below reads PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            Mounting a <code>layout</code> or <code>layoutId</code> element isn't a layout update.
            With nothing changing layout, its <code>x</code> entry animation stays one
            hardware-accelerated <code>transform</code> animation, like the control box. Each row
            counts the element's WAAPI <code>transform</code> animations at 150, 450 and 800 ms.
        </p>
    {/snippet}
    {#if isTester}
        <ul class="verdicts">
            {#each ids as id (id)}
                {@const ok = verdict(id)}
                <li data-tester-verdict={id}>
                    <code>#{id}</code>
                    <span class="chip" class:ok class:pending={ok === null}>
                        {ok === null ? '…' : ok ? 'PASS' : 'FAIL'}
                    </span>
                    <span class="detail">
                        ACCELERATED throughout
                        {#if samples[id]}
                            (saw {samples[id].join(' → ')})
                        {/if}
                    </span>
                </li>
            {/each}
        </ul>
    {/if}
</TesterPanel>

<style>
    .fixture {
        position: fixed;
        top: 0;
        left: 0;
    }

    .verdicts {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 12px;
    }

    .chip {
        margin: 0 6px;
        padding: 1px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        color: white;
        font-weight: 600;
    }

    .chip.ok {
        background: #14532d;
    }

    .chip.pending {
        background: #374151;
    }

    .detail {
        opacity: 0.75;
    }
</style>
