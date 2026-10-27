<script lang="ts">
    import { LayoutGroup, motion } from '$lib'
    import { layoutMeasureStats } from '$lib/utils/motionDomProjection'
    import { onMount, tick } from 'svelte'
    import {
        countTransformAnimations,
        exposeCountTransformAnimations
    } from '../_countTransformAnimations'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import { onPaintedFrame } from '../_paintedFrames'

    /**
     * #4022: a sibling's layout update mustn't distort an element looping a
     * 3D rotation on the compositor. A Svelte port of upstream's
     * `dev/react/src/tests/layout-sibling-rotating-3d.tsx` @ `v14.7.1`
     * (fix `6c6edff28`, tests `11f01c5f6` / `075a6a71f`, comment `4e72d8df5`),
     * driven by `e2e/independent-transforms/layout-rotating-3d.spec.ts` (a
     * port of `tests/react/layout-sibling-rotating-3d.spec.ts`).
     *
     * Upstream's `startUpdate()` reset rotations before measuring, but a
     * rotation still on the compositor kept showing; the measured box was the
     * rotated one, so the pack got a layout animation that inherited its
     * infinite transition and distorted every loop after. Motion 14.7.1
     * demotes the transform group to the main thread first
     * (`demoteTransforms` in motion-dom
     * `projection/node/create-projection-node.ts`).
     *
     * With `?later`, the rotation starts on `window.spin()` rather than on
     * mount.
     *
     * Svelte deviation: upstream's "unmounting" case relies on React Strict
     * Mode's remount. Svelte has none, so the pack sits in `{#key packKey}`
     * and `window.remount()` unmounts the `layoutId="pack"` element and mounts
     * a new one. The new element takes over the `layoutId`, so it mounts as if
     * `initial={false}` (framer-motion `motion/index.tsx:114-122` @ `v14.7.1`;
     * ours is `layoutIdTakeover`) and would sit at its target without looping.
     * That also blocks a looping `animate` declared at mount
     * (`motion-dom` `render/utils/animation-state.ts:370-376`), so a remounted
     * pack (`packKey > 0`) mounts with a static `animate` of `rotateY: 0` and,
     * one frame after it mounts, switches to the `rotateY: [0, 360]` loop with
     * the same infinite transition: an ordinary `animate` change.
     */
    type Recorded = { t: number; transform: string; count: number }
    type FrameWindow = Window & {
        spin: () => void
        remount: () => void
        recordTransforms: (id: string, ms: number) => Promise<Recorded[]>
        measureStats: () => { reads: number; silentReads: number }
    }

    let isSpinning = $state(false)
    let hover = $state(false)
    let packKey = $state(0)

    /**
     * Records `#id`'s inline transform and its transform-animation count once
     * per painted frame, re-querying the element every frame.
     *
     * @param id - The element's `id`.
     * @param ms - How long to record for, in milliseconds.
     * @returns One entry per painted frame.
     */
    const recordTransforms = (id: string, ms: number) =>
        new Promise<Recorded[]>((resolve) => {
            const recorded: Recorded[] = []
            const start = performance.now()
            const stop = onPaintedFrame(() => {
                const el = document.getElementById(id)
                if (el) {
                    recorded.push({
                        t: document.timeline.currentTime as number,
                        transform: el.style.transform,
                        count: countTransformAnimations(id)
                    })
                }
                if (performance.now() - start < ms) return
                stop()
                resolve(recorded)
            })
        })

    const spin = () => {
        isSpinning = true
    }

    /** A remounted pack restarts its loop from 0 (see the header comment). */
    let remountLooping = $state(false)
    const packAnimate = $derived(
        packKey > 0 ? { rotateY: remountLooping ? [0, 360] : 0 } : { rotateY: isSpinning ? 360 : 0 }
    )

    /** Remounts the pack, then starts its loop one frame after the new element mounts. */
    const remount = () => {
        remountLooping = false
        packKey += 1
        void tick().then(() =>
            requestAnimationFrame(() => {
                remountLooping = true
                watch()
            })
        )
    }

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { state: 'waiting' } | { state: 'ok' } | { state: 'bad'; transform: string }
    let isTester = $state(false)
    let verdict = $state<Verdict>({ state: 'waiting' })
    let watching = 0

    /** A recorded transform that projection scaled or translated. */
    const isDistorted = (transform: string) =>
        transform.includes('scale') || /translate3d\((?!0px, 0px)/.test(transform)

    /** Records the pack for 1 s and updates the verdict from those frames. */
    function watch() {
        if (!isTester) return
        const run = ++watching
        void recordTransforms('pack', 1000).then((frames) => {
            if (run !== watching && verdict.state !== 'bad') return
            const bad = frames.find((frame) => isDistorted(frame.transform))
            if (bad) verdict = { state: 'bad', transform: bad.transform }
            else if (verdict.state !== 'bad') verdict = { state: 'ok' }
        })
    }

    const setHover = (value: boolean) => {
        hover = value
        watch()
    }

    onMount(() => {
        isSpinning = !new URLSearchParams(window.location.search).has('later')
        isTester = !window.location.search.includes('@isPlaywright=true')
        exposeCountTransformAnimations()
        const target = window as unknown as FrameWindow
        target.spin = spin
        target.remount = remount
        target.recordTransforms = recordTransforms
        target.measureStats = () => ({ ...layoutMeasureStats })
    })

    const steps: TesterStep[] = [
        {
            text: 'Click "Spin" (or reload without ?later).',
            expected: 'The violet card loops a 3D rotation.',
            action: { label: 'Spin', run: spin }
        },
        {
            text: 'Move the pointer on and off "Hover me" a few times.',
            expected:
                'The card keeps the same shape and size every loop; it never stretches, shrinks or slides.'
        },
        {
            text: 'Click "Remount".',
            expected:
                'The card mounts at rest, then a frame later restarts its loop from the start, in place and undistorted.',
            action: { label: 'Remount', run: remount }
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms · looping rotation vs a sibling's layout update (#4022)</title>
</svelte:head>

<div class="fixture">
    <LayoutGroup>
        <motion.div
            layoutId="hero"
            style={{ position: 'relative', width: '900px', height: '650px' }}
        >
            {#key packKey}
                <motion.div
                    id="pack"
                    layoutId="pack"
                    style={{
                        position: 'absolute',
                        left: '300px',
                        top: '100px',
                        width: '200px',
                        height: '300px',
                        background: 'violet',
                        rotate: -12,
                        rotateX: -12,
                        transformPerspective: 962,
                        z: -80,
                        transformStyle: 'preserve-3d'
                    }}
                    initial={{ rotateY: 0 }}
                    animate={packAnimate}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
            {/key}
            <motion.button
                id="button"
                layoutId="button"
                layoutDependency={hover}
                onmouseenter={() => setHover(true)}
                onmouseleave={() => setHover(false)}
                style={{
                    position: 'absolute',
                    left: '600px',
                    top: '500px',
                    width: '140px',
                    height: '40px'
                }}
            >
                Hover me
            </motion.button>
        </motion.div>
    </LayoutGroup>
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · #4022"
    title="A sibling's layout update doesn't distort a compositor rotation"
    status="Fixed by Motion 14.7.1; distorted on 14.6.0."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict.state === 'ok' ? 'ok' : verdict.state === 'bad' ? 'bad' : 'na'}"
        >
            {verdict.state === 'ok'
                ? 'UNDISTORTED ✓'
                : verdict.state === 'bad'
                  ? 'DISTORTED ✗'
                  : 'WAITING'}
        </span>
        {#if verdict.state === 'bad'}
            <code class="detail">{verdict.transform}</code>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The violet card loops <code>rotateY</code> as one hardware-accelerated
            <code>transform</code> animation. Hovering the button is a layout update of a sibling in
            the same <code>LayoutGroup</code>. Measuring the card while its rotation is still on the
            compositor gave it a layout animation (with the loop's infinite transition), so every
            later loop was scaled or shifted.
        </p>
        <p>
            For 1 s after each hover change or remount, the verdict checks every painted frame's
            inline transform for <code>scale</code> or a non-zero <code>translate3d</code>.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        position: absolute;
        top: 0;
        left: 0;
    }

    .verdict {
        display: inline-block;
        margin-right: 0.25rem;
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

    .detail {
        font-size: 0.7rem;
        word-break: break-all;
    }
</style>
