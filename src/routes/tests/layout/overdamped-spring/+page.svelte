<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import { onPaintedFrame } from '../../independent-transforms/_paintedFrames'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    /**
     * #1207: a slow, heavily overdamped spring layout animation snapped to its
     * target part-way through. A Svelte port of upstream's
     * `dev/react/src/tests/issue-1207.tsx` @ `v14.7.1` (failing test
     * `0325999d2`, fix `154d73c5b` in motion-dom's
     * `animation/generators/spring.ts` and `JSAnimation.ts`, follow-up
     * `251cf56b0`), driven by `e2e/layout/overdamped-spring.spec.ts` (a port of
     * `tests/react/issue-1207.spec.ts`).
     *
     * Physically, its slow mode decays at ~0.115/s, so ~10 s after starting it
     * should still be roughly two thirds of the way there. Before the fix it
     * jumped to the end ~8.6 s in.
     *
     * Svelte deviation: `window.startSampling()` / `window.stopSampling()`
     * replace the spec's in-page rAF loop and record once per painted frame
     * (`onPaintedFrame`).
     */
    type FrameWindow = Window & {
        samples: [number, number][]
        startSampling: () => void
        stopSampling: () => void
    }

    const transition = { type: 'spring', stiffness: 4, damping: 35, mass: 0.5 } as const

    let moved = $state(false)

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict =
        | { state: 'waiting' }
        | { state: 'running' }
        | { state: 'done'; progress: number; maxStep: number }
    let isTester = $state(false)
    let verdict = $state<Verdict>({ state: 'waiting' })

    let stopSampling = () => {}

    /**
     * Clicks the toggle and records `[ms since click, box left]` once per
     * painted frame into `window.samples`, until {@link stopSampling}.
     */
    const startSampling = () => {
        stopSampling()
        const w = window as unknown as FrameWindow
        const samples: [number, number][] = []
        w.samples = samples
        const box = document.getElementById('box')!
        const button = document.getElementById('toggle')!
        const start = performance.now()
        stopSampling = onPaintedFrame(() => {
            samples.push([performance.now() - start, box.getBoundingClientRect().left])
        })
        button.click()
    }

    const runTester = () => {
        startSampling()
        verdict = { state: 'running' }
        setTimeout(() => {
            stopSampling()
            const samples = (window as unknown as FrameWindow).samples
            const startLeft = samples[0][1]
            const at = samples.find(([t]) => t >= 10000) ?? samples[samples.length - 1]
            let maxStep = 0
            for (let i = 1; i < samples.length; i++) {
                maxStep = Math.max(maxStep, Math.abs(samples[i][1] - samples[i - 1][1]))
            }
            verdict = { state: 'done', progress: Math.abs(at[1] - startLeft) / 1000, maxStep }
        }, 10500)
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        const w = window as unknown as FrameWindow
        w.startSampling = startSampling
        w.stopSampling = () => stopSampling()
        return () => stopSampling()
    })

    const steps: TesterStep[] = [
        {
            text: 'Click "Toggle" and watch the box for 10 seconds.',
            expected:
                'It glides right, slower and slower, and is still short of the right edge after 10 s. It never jumps to the end.',
            action: { label: 'Toggle', run: runTester }
        }
    ]

    const smooth = $derived(
        verdict.state === 'done' && verdict.progress < 0.8 && verdict.maxStep < 10
    )
</script>

<svelte:head>
    <title>Layout · slow overdamped spring layout animation (#1207)</title>
</svelte:head>

<div class="fixture">
    <button id="toggle" onclick={() => (moved = !moved)}>Toggle</button>
    <motion.div
        id="box"
        layout
        {transition}
        style={{
            position: 'absolute',
            top: '100px',
            left: moved ? '1000px' : '0px',
            width: '100px',
            height: '100px',
            background: 'blue'
        }}
    />
</div>

<TesterPanel
    eyebrow="Motion 14.7 · #1207"
    title="A slow overdamped spring eases all the way"
    status="Fixed by Motion 14.7; snapped ~8.6 s in on 14.6.0."
    {steps}
>
    {#snippet summary()}
        {#if isTester}
            {#if verdict.state === 'done'}
                <span class="verdict {smooth ? 'ok' : 'bad'}">
                    {smooth ? 'SMOOTH ✓' : 'SNAPPED ✗'}
                </span>
                <span>progress at 10 s: {Math.round(verdict.progress * 100)}%</span>
            {:else}
                <span class="verdict na"
                    >{verdict.state === 'running' ? 'RECORDING' : 'WAITING'}</span
                >
            {/if}
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The box is a <code>layout</code> element with a spring of stiffness 4, damping 35 and mass
            0.5. Toggling moves it 1000px right. The page records its painted left edge every frame for
            10.5 s: progress at 10 s must stay under 80% and no frame may step 10px or more.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        position: relative;
        width: 1200px;
        height: 300px;
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
</style>
