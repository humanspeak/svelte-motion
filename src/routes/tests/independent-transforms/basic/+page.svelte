<script lang="ts">
    import { animate, motion, useMotionValue } from '$lib'
    import type { TransformTemplate } from 'motion-dom'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Independent transforms on motion elements (Motion 14.2). A Svelte port of
     * upstream's `dev/react/src/tests/independent-transforms.tsx` @ `v14.2.0`,
     * driven by `e2e/independent-transforms/basic.spec.ts` (a port of
     * `tests/react/independent-transforms.spec.ts`).
     *
     * Values Motion creates for `x`, `y`, `scale`, `rotate` and so on are
     * composed into one accelerated WAAPI `transform` animation per element,
     * unless something needs them on the main thread: a `transformTemplate`,
     * an `onUpdate` callback, an external motion value, or a layout
     * animation (see motion-dom's
     * `animation/waapi/transforms/TransformAnimation.ts`,
     * `canAccelerateTransform`).
     *
     * The six box ids match upstream's; keep them stable. The boxes sit at the
     * top-left of the viewport like upstream's, because the spec checks the
     * `layout` box ends at `x ≈ 100`.
     */
    const transition = { duration: 1, ease: 'linear' } as const

    const box = {
        width: '100px',
        height: '50px',
        background: '#0077ff'
    }

    const externalX = useMotionValue(0)
    let isWide = $state(false)

    const identityTemplate: TransformTemplate = (_, generated) => generated
    const lateTemplate: TransformTemplate = (_, generated) => generated + ' rotate(45deg)'

    /** Ids of the six fixture boxes, in render order. */
    const ids = ['accelerated', 'template', 'late-template', 'on-update', 'external', 'layout']

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

    /** What each box should report: accelerated early, and after 650 ms. */
    const expected: Record<string, { early: number; late: number; label: string }> = {
        accelerated: { early: 1, late: 1, label: 'ACCELERATED throughout' },
        template: { early: 0, late: 0, label: 'MAIN THREAD throughout' },
        'late-template': { early: 1, late: 0, label: 'ACCELERATED, then DEMOTED at 300 ms' },
        'on-update': { early: 0, late: 0, label: 'MAIN THREAD throughout' },
        external: { early: 0, late: 0, label: 'MAIN THREAD throughout' },
        layout: { early: 1, late: 0, label: 'ACCELERATED, then DEMOTED at 300 ms' }
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

        const timeout = setTimeout(() => (isWide = true), 300)
        const animation = animate(externalX, 100, transition)
        const timers = isTester
            ? [setTimeout(() => sampleAll('early'), 150), setTimeout(() => sampleAll('late'), 650)]
            : []
        return () => {
            clearTimeout(timeout)
            timers.forEach(clearTimeout)
            animation.stop()
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
            text: 'Reload the page and watch the six blue boxes in the top-left corner for one second.',
            expected:
                'Every box slides 100px right. "accelerated" and "external" also grow to 1.5×; "late-template" tilts 45° and "layout" widens to 200px about a third of the way in. The verdict list reads PASS for all six.',
            action: { label: 'Reload', run: () => window.location.reload() }
        },
        {
            text: 'Hover the first box ("accelerated").',
            expected: 'It rotates to 45° smoothly while staying on the accelerated path.'
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms — accelerated parity</title>
</svelte:head>

<div class="fixture">
    <motion.div
        id="accelerated"
        style={box}
        animate={{ x: 100, scale: 1.5 }}
        {transition}
        whileHover={{ rotate: 45 }}
    />
    <motion.div
        id="template"
        style={box}
        animate={{ x: 100 }}
        {transition}
        transformTemplate={identityTemplate}
    />
    <motion.div
        id="late-template"
        style={box}
        animate={{ x: 100 }}
        {transition}
        transformTemplate={isWide ? lateTemplate : undefined}
    />
    <motion.div id="on-update" style={box} animate={{ x: 100 }} {transition} onUpdate={() => {}} />
    <motion.div
        id="external"
        style={{ ...box, x: externalX }}
        animate={{ scale: 1.5 }}
        {transition}
    />
    <motion.div
        id="layout"
        layout
        style={{ ...box, width: isWide ? '200px' : '100px' }}
        animate={{ x: 100 }}
        transition={{ x: transition, layout: { duration: 0.2 } }}
    />
</div>

<TesterPanel
    eyebrow="dev/react/src/tests/independent-transforms.tsx"
    title="Independent transforms run on the compositor"
    status="Expected on Chromium with Motion 14.2: every row below reads PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            Motion 14.2 composes <code>x</code>, <code>scale</code>, <code>rotate</code> and friends
            into one hardware-accelerated <code>transform</code> animation per element. A
            <code>transformTemplate</code>, an <code>onUpdate</code> callback, an external motion
            value or a layout animation keep (or move) the element on the main thread instead. Each
            row counts the element's WAAPI <code>transform</code> animations at 150 ms and 650 ms.
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
