<script lang="ts">
    import { motion } from '$lib'
    import type { ResolvedValues } from 'motion-dom'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * The `onUpdate(latest)` prop on motion components (Motion parity).
     * Driven by `e2e/motion/on-update.spec.ts`.
     *
     * Motion 14.2 runs independent transforms as one accelerated WAAPI
     * animation per element, but keeps an element on the main thread when it
     * has an `onUpdate` prop, because the callback needs every value on every
     * frame (motion-dom `canAccelerateTransform`). Adding the prop mid-animation
     * demotes the running group (`VisualElement.update`).
     *
     * - `#prop`: `onUpdate` prop; writes the latest `x` and the call count.
     * - `#transition`: transition-level `onUpdate` only (per animation).
     * - `#late`: `onUpdate` prop added 300 ms after mount.
     * - `#control`: no `onUpdate` at all; stays accelerated.
     */
    const transition = { duration: 1, ease: 'linear' } as const

    const box = {
        width: '100px',
        height: '50px',
        background: '#0077ff'
    }

    let propLatest = $state(0)
    let propCalls = $state(0)
    let hasLateUpdate = $state(false)

    const onPropUpdate = (latest: ResolvedValues) => {
        propLatest = Math.round(Number(latest.x))
        propCalls += 1
    }
    const noop = () => {}

    /** Ids of the fixture boxes, in render order. */
    const ids = ['prop', 'transition', 'late', 'control']

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
    type Track = { early: number | null; late: number | null }
    let isTester = $state(false)
    let tracks = $state<Record<string, Track>>({})

    /** What each box should report: accelerated early, and after 450 ms. */
    const expected: Record<string, { early: number; late: number; label: string }> = {
        prop: { early: 0, late: 0, label: 'MAIN THREAD throughout' },
        transition: { early: 0, late: 0, label: 'MAIN THREAD throughout' },
        late: { early: 1, late: 0, label: 'ACCELERATED, then DEMOTED at 300 ms' },
        control: { early: 1, late: 1, label: 'ACCELERATED throughout' }
    }

    const sampleAll = (phase: keyof Track) => {
        for (const id of ids) {
            const track = tracks[id] ?? { early: null, late: null }
            track[phase] = countTransformAnimations(id)
            tracks[id] = track
        }
    }

    onMount(() => {
        ;(window as unknown as Record<string, unknown>).countTransformAnimations =
            countTransformAnimations
        isTester = !window.location.search.includes('@isPlaywright=true')

        const timeout = setTimeout(() => (hasLateUpdate = true), 300)
        const timers = isTester
            ? [setTimeout(() => sampleAll('early'), 150), setTimeout(() => sampleAll('late'), 450)]
            : []
        return () => {
            clearTimeout(timeout)
            timers.forEach(clearTimeout)
        }
    })

    const verdict = (id: string) => {
        const track = tracks[id]
        if (!track || track.early === null || track.late === null) return null
        const want = expected[id]
        return track.early === want.early && track.late === want.late
    }

    const steps: TesterStep[] = [
        {
            text: 'Reload the page and watch the four blue boxes in the top-left corner for one second.',
            expected:
                'Every box slides 100px right at a steady speed, with no jump when "late" gains its onUpdate 300 ms in. The readout ends at "latest x: 100" with dozens of calls, and the verdict list reads PASS for all four.',
            action: { label: 'Reload', run: () => window.location.reload() }
        }
    ]
</script>

<svelte:head>
    <title>onUpdate prop — main-thread parity</title>
</svelte:head>

<div class="fixture">
    <motion.div id="prop" style={box} animate={{ x: 100 }} {transition} onUpdate={onPropUpdate} />
    <motion.div
        id="transition"
        style={box}
        animate={{ x: 100 }}
        transition={{ ...transition, onUpdate: noop }}
    />
    <motion.div
        id="late"
        style={box}
        animate={{ x: 100 }}
        {transition}
        onUpdate={hasLateUpdate ? noop : undefined}
    />
    <motion.div id="control" style={box} animate={{ x: 100 }} {transition} />
    <p class="readout">
        latest x: <span data-testid="prop-latest">{propLatest}</span>, calls:
        <span data-testid="prop-calls">{propCalls}</span>
    </p>
</div>

<TesterPanel
    eyebrow="onUpdate prop"
    title="onUpdate keeps transforms on the main thread"
    status="Expected on Chromium with Motion 14.2: every row below reads PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            An <code>onUpdate</code> prop is called once per frame with every latest value, so
            Motion keeps the element's transforms on the main thread instead of the compositor.
            Adding the prop mid-animation demotes the running animation. Each row counts the
            element's WAAPI
            <code>transform</code> animations at 150 ms and 450 ms.
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
                        {expected[id].label}
                        {#if tracks[id]}
                            (saw {tracks[id].early} → {tracks[id].late})
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

    .readout {
        margin: 8px 0 0;
        font: 12px monospace;
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
