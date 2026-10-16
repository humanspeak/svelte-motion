<script lang="ts">
    import { LayoutGroup, motion } from '$lib'
    import { onMount } from 'svelte'
    import {
        countTransformAnimations,
        exposeCountTransformAnimations
    } from '../_countTransformAnimations'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import { onPaintedFrame } from '../_paintedFrames'

    /**
     * Turning `layout` / `layoutId` back on is a mount, not an update (Motion
     * 14.2 parity). Driven by `e2e/independent-transforms/layout-toggle.spec.ts`.
     *
     * Upstream renders `MeasureLayout` only while `layout`, `layoutId` or
     * `drag` is set (framer-motion `motion/index.tsx` @ `v14.2.0`, 205-219),
     * so turning the prop off unmounts it and turning it back on mounts it
     * again: `componentDidMount` runs, never `willUpdate()`
     * (`motion/features/layout/MeasureLayout.tsx`, 39-65).
     *
     * - `#toggle-layout` and `#toggle-layout-id` run a slow accelerated `x`
     *   animation. Re-enabling must not move it to the main thread.
     * - `#toggle-widen` is re-enabled in the same update that widens it. The
     *   widen isn't a layout update of a mounted element, so it jumps.
     */
    const transition = { x: { duration: 2, ease: 'linear' } } as const
    const box = { width: '100px', height: '40px', background: '#0077ff' }

    let layoutOn = $state(true)
    let layoutIdOn = $state(true)
    let widenOn = $state(true)
    let widenWidth = $state(100)

    /**
     * Turns `layout` / `layoutId` off on the two `x` boxes, then back on in a
     * later frame.
     *
     * @returns Resolves once both props are back on.
     */
    const toggleOffOn = () =>
        new Promise<void>((resolve) => {
            layoutOn = false
            layoutIdOn = false
            setTimeout(() => {
                layoutOn = true
                layoutIdOn = true
                resolve()
            }, 100)
        })

    /**
     * Turns `#toggle-widen`'s `layout` off, then back on in the same update
     * that widens it, sampling its painted width once per frame from then on
     * (see `onPaintedFrame`).
     *
     * @param frames - How many frames to sample after the widen.
     * @returns The sampled widths, in frame order.
     */
    const reenableAndWiden = (frames: number) =>
        new Promise<number[]>((resolve) => {
            widenOn = false
            setTimeout(() => {
                const el = document.getElementById('toggle-widen')!
                const widths: number[] = []
                const stop = onPaintedFrame(() => {
                    widths.push(el.getBoundingClientRect().width)
                    if (widths.length < frames) return
                    stop()
                    resolve(widths)
                })
                widenOn = true
                widenWidth = widenWidth === 100 ? 300 : 100
            }, 100)
        })

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let counts = $state<Record<string, number[]>>({})
    let widths = $state<number[] | null>(null)

    const runToggle = () => {
        counts = {}
        void toggleOffOn().then(() => {
            for (const time of [50, 200, 400]) {
                setTimeout(() => {
                    for (const id of ['toggle-layout', 'toggle-layout-id']) {
                        counts[id] = [...(counts[id] ?? []), countTransformAnimations(id)]
                    }
                }, time)
            }
        })
    }

    const runWiden = () => {
        widths = null
        void reenableAndWiden(10).then((sampled) => (widths = sampled))
    }

    onMount(() => {
        const target = window as unknown as Record<string, unknown>
        exposeCountTransformAnimations()
        target.toggleOffOn = toggleOffOn
        target.reenableAndWiden = reenableAndWiden
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const countVerdict = (id: string) => {
        const seen = counts[id]
        if (!seen || seen.length < 3) return null
        return seen.every((count) => count === 1)
    }

    const widenVerdict = $derived(widths === null ? null : Math.abs(widths[0] - widenWidth) <= 2)

    const steps: TesterStep[] = [
        {
            text: 'Reload the page.',
            expected: 'The top two boxes slide 200px right over two seconds.',
            action: { label: 'Reload', run: () => window.location.reload() }
        },
        {
            text: 'Straight after reloading, while those boxes are still sliding, press "Toggle off and on".',
            expected:
                'Both boxes keep sliding at the same steady pace; nothing jumps or changes size. The two "accelerated" rows read PASS.',
            action: { label: 'Toggle off and on', run: runToggle }
        },
        {
            text: 'Press "Re-enable and widen".',
            expected:
                'The bottom box changes width at once, without a growing animation. The "re-enable" row reads PASS.',
            action: { label: 'Re-enable and widen', run: runWiden }
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms — re-enabling layout is a mount</title>
</svelte:head>

<div class="fixture">
    <motion.div
        id="toggle-layout"
        layout={layoutOn}
        style={box}
        animate={{ x: 200 }}
        {transition}
    />
    <LayoutGroup>
        <motion.div
            id="toggle-layout-id"
            layoutId={layoutIdOn ? 'toggle-shared' : undefined}
            style={box}
            animate={{ x: 200 }}
            {transition}
        />
    </LayoutGroup>
    <motion.div
        id="toggle-widen"
        layout={widenOn}
        style={{ ...box, width: `${widenWidth}px` }}
        transition={{ layout: { duration: 1, ease: 'linear' } }}
    />
</div>

<TesterPanel
    eyebrow="framer-motion MeasureLayout.tsx (mount vs update)"
    title="Re-enabling layout is a mount"
    status="Expected on Chromium with Motion 14.2: every row below reads PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            Turning <code>layout</code> or <code>layoutId</code> off and back on mounts layout
            measuring again; it isn't a layout update. The sliding boxes stay one
            hardware-accelerated
            <code>transform</code> animation, and a widen in the same update as the re-enable doesn't
            animate.
        </p>
    {/snippet}
    {#if isTester}
        <ul class="verdicts">
            {#each ['toggle-layout', 'toggle-layout-id'] as id (id)}
                {@const ok = countVerdict(id)}
                <li data-tester-verdict={id}>
                    <code>#{id} accelerated</code>
                    <span class="chip" class:ok class:pending={ok === null}>
                        {ok === null ? '…' : ok ? 'PASS' : 'FAIL'}
                    </span>
                    <span class="detail">
                        1 transform animation after re-enabling
                        {#if counts[id]}(saw {counts[id].join(' → ')}){/if}
                    </span>
                </li>
            {/each}
            <li data-tester-verdict="toggle-widen">
                <code>#toggle-widen re-enable</code>
                <span class="chip" class:ok={widenVerdict} class:pending={widenVerdict === null}>
                    {widenVerdict === null ? '…' : widenVerdict ? 'PASS' : 'FAIL'}
                </span>
                <span class="detail">
                    new width on the first frame
                    {#if widths}(saw {Math.round(widths[0])}px){/if}
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
