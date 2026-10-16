<script lang="ts" module>
    /**
     * `performance.now()` of every `resize` event since this module loaded
     * (as early as the page's own script runs; tester verdicts only).
     */
    const resizeTimes: number[] = []
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => resizeTimes.push(performance.now()))
    }
</script>

<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import { onPaintedFrame } from '../_paintedFrames'

    /**
     * A layout change made right after a `layout` element mounts, on a
     * server-rendered (hydrated) load and on a client-side navigation.
     * Driven by `e2e/independent-transforms/layout-hydration.spec.ts`.
     *
     * Upstream: hydrate → `componentDidMount` → a parent effect sets state →
     * a new commit → `getSnapshotBeforeUpdate` → `willUpdate()`, so the change
     * animates (framer-motion `motion/features/layout/MeasureLayout.tsx`
     * @ `v14.2.0`, 39-98).
     *
     * - `#hydrate-mount` widens 100 → 300 from this page's `onMount`.
     * - `#hydrate-effect` widens 100 → 300 from a `$effect`'s first run.
     *
     * Both must animate over the 1s layout transition however the page was
     * loaded: a full load (`page.goto`, hydrated) or a link from the index
     * (client-side navigation).
     */
    const transition = { layout: { duration: 1, ease: 'linear' } } as const
    const box = { height: '40px', background: '#0077ff' }

    let mountWidth = $state(100)
    let effectWidth = $state(100)

    /** The `$effect` below widens `#hydrate-effect` on its first run. */
    const widenFromEffect = () => {
        effectWidth = 300
    }

    $effect(() => {
        widenFromEffect()
    })

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    const widths: Record<string, number[]> = { 'hydrate-mount': [], 'hydrate-effect': [] }
    let verdicts = $state<Record<string, number[]> | null>(null)
    /**
     * True when the browser sent a `resize` between mount and the first
     * frame. Motion's root stores `innerWidth` in its first `frame.read`, so
     * such a resize (even a same-size one) counts as a width change and
     * finishes every layout animation (motion-dom `create-projection-node.ts`
     * @ `v14.2.0`, 482-508). React Motion does the same, so that load isn't
     * judged. Hydration is synchronous, so no resize lands between Motion's
     * listener being attached and `onMount`.
     */
    let resizedBeforeFirstFrame = $state(false)

    onMount(() => {
        mountWidth = 300
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return
        const startedAt = performance.now()
        // A resize in the first frame is dispatched before its rAF callbacks.
        requestAnimationFrame(() => {
            const firstFrameAt = performance.now()
            resizedBeforeFirstFrame = resizeTimes.some(
                (time) => time >= startedAt && time <= firstFrameAt
            )
        })
        const stop = onPaintedFrame(() => {
            for (const id of Object.keys(widths)) {
                const el = document.getElementById(id)
                if (el) widths[id].push(Math.round(el.getBoundingClientRect().width))
            }
            if (performance.now() - startedAt < 1300) return
            stop()
            verdicts = { ...widths }
        })
    })

    const animated = (values: number[]) => values.some((width) => width > 110 && width < 290)

    const steps: TesterStep[] = [
        {
            text: 'Reload the page (a full, server-rendered load).',
            expected: 'Both boxes grow from 100px to 300px over one second. Both rows read PASS.',
            action: { label: 'Reload', run: () => window.location.reload() }
        },
        {
            text: 'Go back to the index and follow the "Layout change right after hydration" link again (a client-side navigation).',
            expected: 'Same: both boxes grow over one second, and both rows read PASS.'
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms — layout change right after hydration</title>
</svelte:head>

<div class="fixture">
    <motion.div
        id="hydrate-mount"
        layout
        style={{ ...box, width: `${mountWidth}px` }}
        {transition}
    />
    <div class="gap"></div>
    <motion.div
        id="hydrate-effect"
        layout
        style={{ ...box, width: `${effectWidth}px` }}
        {transition}
    />
</div>

<TesterPanel
    eyebrow="framer-motion MeasureLayout.tsx (componentDidMount → getSnapshotBeforeUpdate)"
    title="Layout change right after hydration"
    status="Expected on Chromium with Motion 14.2: both rows below read PASS. A reload in some embedded browsers reads “not judged” instead (the browser sends a resize before the first frame)."
    {steps}
>
    {#snippet checks()}
        <p>
            Each box widens in the first flush after it mounts. That is a layout update, so it
            animates, whether the page was server-rendered and hydrated or reached by a link.
        </p>
        <p>
            If the browser sends a <code>resize</code> before the first frame (some embedded browsers
            do on reload), Motion finishes every layout animation, as React Motion does, so that load
            reads “not judged” instead of PASS or FAIL.
        </p>
    {/snippet}
    {#if isTester}
        <ul class="verdicts">
            {#each ['hydrate-mount', 'hydrate-effect'] as id (id)}
                {@const values = verdicts?.[id]}
                {@const ok = values === undefined ? null : animated(values)}
                {@const notJudged = values !== undefined && resizedBeforeFirstFrame}
                <li data-tester-verdict={id}>
                    <code>#{id} animates 100 → 300</code>
                    <span
                        class="chip"
                        class:ok={ok && !notJudged}
                        class:pending={ok === null || notJudged}
                    >
                        {ok === null ? '…' : notJudged ? 'not judged' : ok ? 'PASS' : 'FAIL'}
                    </span>
                    <span class="detail">
                        {#if notJudged}
                            the browser sent a resize before the first frame (Motion finishes layout
                            animations on resize, same as React)
                        {:else if values}
                            first widths {values.slice(0, 6).join(', ')}
                        {/if}
                    </span>
                </li>
            {/each}
        </ul>
        {#if verdicts && resizedBeforeFirstFrame}
            <p class="hint" data-tester-hint>
                This browser sends a resize on every reload. Use step 2 (follow the link from the
                index) here, or press Reload in Chrome or another regular browser.
            </p>
        {/if}
    {/if}
</TesterPanel>

<style>
    .fixture {
        position: fixed;
        top: 0;
        left: 0;
    }

    .gap {
        height: 60px;
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
        white-space: nowrap;
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

    .hint {
        margin: 8px 0 0;
        font-size: 12px;
    }

    .detail {
        opacity: 0.75;
    }
</style>
