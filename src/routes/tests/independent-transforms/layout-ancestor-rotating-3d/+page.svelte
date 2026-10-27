<script lang="ts">
    import { motion } from '$lib'
    import { layoutMeasureStats } from '$lib/utils/motionDomProjection'
    import { onMount } from 'svelte'
    import {
        countTransformAnimations,
        exposeCountTransformAnimations
    } from '../_countTransformAnimations'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import { onPaintedFrame } from '../_paintedFrames'

    /**
     * #4022: a child's layout update mustn't be measured inside an ancestor
     * that's still rotated on the compositor. A Svelte port of upstream's
     * `dev/react/src/tests/layout-ancestor-rotating-3d.tsx` @ `v14.7.1`
     * (fix `6c6edff28`, tests `11f01c5f6` / `075a6a71f`), driven by
     * `e2e/independent-transforms/layout-rotating-3d.spec.ts` (a port of
     * `tests/react/layout-sibling-rotating-3d.spec.ts`).
     *
     * The rotation starts on `window.spin()`; `window.rerender()` bumps the
     * child's `layoutDependency`, a layout update of the child alone. Measured
     * inside the still-rotated ancestor, the child got a scale/translate
     * correction and the ancestor a layout animation of its own.
     *
     * Svelte deviation: upstream keeps the counter in a `Child` component;
     * here it is page-local `$state`, so the fixture stays one file.
     */
    type Recorded = { transform: string; count: number }
    type FrameWindow = Window & {
        spin: () => void
        rerender: () => void
        recordTransforms: (id: string, ms: number) => Promise<Recorded[]>
        measureStats: () => { reads: number; silentReads: number }
    }

    let isSpinning = $state(false)
    let count = $state(0)

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

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { state: 'waiting' } | { state: 'ok' } | { state: 'bad'; detail: string }
    let isTester = $state(false)
    let verdict = $state<Verdict>({ state: 'waiting' })

    /** A recorded transform that projection scaled or translated. */
    const isDistorted = (transform: string) =>
        transform.includes('scale') || /translate3d\((?!0px, 0px)/.test(transform)

    const rerender = () => {
        count += 1
        if (!isTester) return
        void Promise.all([recordTransforms('child', 1000), recordTransforms('pack', 1000)]).then(
            ([child, pack]) => {
                const badChild = child.find((frame) => !['', 'none'].includes(frame.transform))
                const badPack = pack.find((frame) => isDistorted(frame.transform))
                if (badChild) verdict = { state: 'bad', detail: `#child: ${badChild.transform}` }
                else if (badPack) verdict = { state: 'bad', detail: `#pack: ${badPack.transform}` }
                else if (verdict.state !== 'bad') verdict = { state: 'ok' }
            }
        )
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        exposeCountTransformAnimations()
        const target = window as unknown as FrameWindow
        target.spin = spin
        target.rerender = rerender
        target.recordTransforms = recordTransforms
        target.measureStats = () => ({ ...layoutMeasureStats })
    })

    const steps: TesterStep[] = [
        {
            text: 'Click "Spin".',
            expected: 'The violet card loops a 3D rotation.',
            action: { label: 'Spin', run: spin }
        },
        {
            text: 'Wait a second, then click "Re-render child" a few times.',
            expected:
                'The red square stays fixed in the card’s corner and the card keeps the same shape and size every loop; nothing stretches, shrinks or slides.',
            action: { label: 'Re-render child', run: rerender }
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms · rotating ancestor vs a child's layout update (#4022)</title>
</svelte:head>

<motion.div
    id="pack"
    layout
    style={{
        position: 'absolute',
        left: '300px',
        top: '100px',
        width: '200px',
        height: '300px',
        background: 'violet',
        rotate: -12,
        transformPerspective: 962
    }}
    initial={{ rotateY: 0 }}
    animate={{ rotateY: isSpinning ? 360 : 0 }}
    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
>
    <motion.div
        id="child"
        layout
        layoutDependency={count}
        style={{
            position: 'absolute',
            left: '20px',
            top: '20px',
            width: '100px',
            height: '100px',
            background: 'red'
        }}
    />
</motion.div>

<TesterPanel
    eyebrow="Motion 14.7.1 · #4022"
    title="A child's layout update inside a rotating ancestor isn't distorted"
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
            <code class="detail">{verdict.detail}</code>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The violet card loops <code>rotateY</code> on the compositor. Re-rendering the red child is
            a layout update of the child only. Measured inside the still-rotated card, the child got a
            scale/translate correction and the card a layout animation.
        </p>
        <p>
            For 1 s after each re-render, the verdict checks every painted frame: the child's inline
            transform must stay empty (or <code>none</code>), and the card's must have no
            <code>scale</code> or non-zero <code>translate3d</code>.
        </p>
    {/snippet}
</TesterPanel>

<style>
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
