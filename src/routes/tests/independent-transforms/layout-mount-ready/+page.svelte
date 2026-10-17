<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import { onPaintedFrame } from '../_paintedFrames'

    /**
     * Layout changes during a `layout` element's enter frames (Motion 14.2
     * parity). Driven by `e2e/independent-transforms/layout-mount-ready.spec.ts`.
     *
     * Upstream mounts `MeasureLayout` with the element, so every later commit
     * is an update: `getSnapshotBeforeUpdate` snapshots and `willUpdate()`s
     * even while the enter animation is still starting (framer-motion
     * `motion/features/layout/MeasureLayout.tsx` @ `v14.2.0`, 39-98).
     *
     * - `#enter-change` widens from `onAnimationStart`, which fires while the
     *   element is still entering. It must animate from 100px, not jump.
     * - `#sibling-shift` is pushed down by a sibling during its enter frames,
     *   then widens 600ms later. That later layout animation must start from
     *   where the box is drawn, not from its mount position.
     *
     * The boxes mount client-side (press "Mount") so the enter runs through
     * the normal requestAnimationFrame path, not the SSR appear handoff.
     */
    const transition = {
        x: { duration: 2, ease: 'linear' },
        layout: { duration: 1, ease: 'linear' }
    } as const

    const box = { height: '40px', background: '#0077ff' }

    let shown = $state(false)
    let enterWidth = $state(100)
    let siblingHeight = $state(0)
    let shiftWidth = $state(100)
    let shiftTimer: ReturnType<typeof setTimeout> | undefined
    /** `performance.now()` when `#sibling-shift` was widened. */
    let widenedAt: number | null = null

    /** One painted rect, with the `performance.now()` it was read at. */
    type Rect = { t: number; left: number; top: number; width: number }

    /**
     * Mounts the boxes and samples each one's painted rect once per frame
     * (see `onPaintedFrame`).
     *
     * @param ms - How long to sample for, in milliseconds.
     * @returns Painted rects per box id, in frame order, plus when
     *     `#sibling-shift` was widened.
     */
    const mountAndSample = (ms: number) =>
        new Promise<{ samples: Record<string, Rect[]>; widenedAt: number | null }>((resolve) => {
            const samples: Record<string, Rect[]> = { 'enter-change': [], 'sibling-shift': [] }
            const stop = onPaintedFrame(() => {
                for (const id of Object.keys(samples)) {
                    const el = document.getElementById(id)
                    if (!el) continue
                    const { left, top, width } = el.getBoundingClientRect()
                    samples[id].push({ t: performance.now(), left, top, width })
                }
            })
            setTimeout(() => {
                stop()
                resolve({ samples, widenedAt })
            }, ms)
            shown = true
        })

    const onEnterStart = () => {
        enterWidth = 300
    }

    const onShiftStart = () => {
        siblingHeight = 40
        shiftTimer = setTimeout(() => {
            widenedAt = performance.now()
            shiftWidth = 300
        }, 600)
    }

    /**
     * Largest frame-to-frame change of one rect field.
     *
     * @param rects - Sampled rects in frame order.
     * @param key - Field to compare.
     * @returns The largest absolute step, or 0 with fewer than two samples.
     */
    const maxStep = (rects: Rect[], key: Exclude<keyof Rect, 't'>) => {
        let max = 0
        for (let i = 1; i < rects.length; i++) {
            max = Math.max(max, Math.abs(rects[i][key] - rects[i - 1][key]))
        }
        return max
    }

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let enterStep = $state<number | null>(null)
    let shiftStep = $state<number | null>(null)

    const run = () => {
        void mountAndSample(1800).then(({ samples, widenedAt }) => {
            enterStep = maxStep(samples['enter-change'], 'width')
            // Only the widen is checked: the sibling push during the enter
            // frames isn't a change of this box's own props. The first frame
            // read before the widen is kept as the starting point.
            const frames = samples['sibling-shift']
            const first = frames.findIndex((rect) => widenedAt !== null && rect.t >= widenedAt)
            const widenFrames = first < 1 ? [] : frames.slice(first - 1)
            shiftStep = Math.max(maxStep(widenFrames, 'left'), maxStep(widenFrames, 'top'))
        })
    }

    onMount(() => {
        const target = window as unknown as Record<string, unknown>
        target.mountAndSample = mountAndSample
        isTester = !window.location.search.includes('@isPlaywright=true')
        return () => clearTimeout(shiftTimer)
    })

    const steps: TesterStep[] = [
        {
            text: 'Press "Mount" and watch both blue boxes as they appear.',
            expected:
                'The top box grows smoothly from 100px to 300px wide over one second. The bottom box is pushed down once, then a moment later grows smoothly to 300px without jumping sideways or up. Both verdicts read PASS.',
            action: { label: 'Mount', run }
        },
        {
            text: 'To run it again, reload the page and press "Mount".',
            expected: 'Same as above.',
            action: { label: 'Reload', run: () => window.location.reload() }
        }
    ]

    const verdict = (step: number | null, limit: number) =>
        step === null ? '…' : step <= limit ? 'PASS' : 'FAIL'
</script>

<svelte:head>
    <title>Independent transforms — layout changes during the enter frames</title>
</svelte:head>

<div class="fixture">
    {#if shown}
        <motion.div
            id="enter-change"
            layout
            initial={{ x: 0 }}
            animate={{ x: 40 }}
            {transition}
            style={{ ...box, width: `${enterWidth}px` }}
            onAnimationStart={onEnterStart}
        />
        <div style={`height: ${siblingHeight}px`}></div>
        <motion.div
            id="sibling-shift"
            layout
            initial={{ x: 0 }}
            animate={{ x: 40 }}
            {transition}
            style={{ ...box, width: `${shiftWidth}px` }}
            onAnimationStart={onShiftStart}
        />
    {/if}
    <button id="mount" type="button" onclick={run}>Mount</button>
</div>

<TesterPanel
    eyebrow="framer-motion MeasureLayout.tsx (mount vs update)"
    title="Layout changes during the enter frames"
    status="Expected on Chromium with Motion 14.2: both rows below read PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            A <code>layout</code> element is mounted as soon as it appears, so a size change while its
            enter animation is still starting is a layout update and animates. A later layout animation
            starts from where the box is drawn.
        </p>
    {/snippet}
    {#if isTester}
        <ul class="verdicts">
            <li data-tester-verdict="enter-change">
                <code>#enter-change largest width step</code>
                <span
                    class="chip"
                    class:ok={verdict(enterStep, 40) === 'PASS'}
                    class:pending={enterStep === null}
                >
                    {verdict(enterStep, 40)}
                </span>
                <span class="detail">
                    at most 40px {#if enterStep !== null}(saw {enterStep.toFixed(1)}px){/if}
                </span>
            </li>
            <li data-tester-verdict="sibling-shift">
                <code>#sibling-shift largest move during widen</code>
                <span
                    class="chip"
                    class:ok={verdict(shiftStep, 10) === 'PASS'}
                    class:pending={shiftStep === null}
                >
                    {verdict(shiftStep, 10)}
                </span>
                <span class="detail">
                    at most 10px {#if shiftStep !== null}(saw {shiftStep.toFixed(1)}px){/if}
                </span>
            </li>
        </ul>
    {/if}
</TesterPanel>

<style>
    .fixture {
        position: fixed;
        top: 0;
        left: 0;
    }

    #mount {
        margin-top: 8px;
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
