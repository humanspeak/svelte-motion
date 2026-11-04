<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import { onPaintedFrame } from '../../independent-transforms/_paintedFrames'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    /**
     * Plan 012 A6: an unrelated reflow mid a plain `layout` animation (no
     * `layoutId`, nothing shared). Driven by
     * `e2e/layout/reflow-mid-animation.spec.ts`.
     *
     * "Move" slides the box 400px right over one second. Part-way through,
     * its own content grows 10px taller: the box's ResizeObserver commits the
     * change (`commitObservedLayoutChange`). Upstream re-renders the box, and
     * its `willUpdate()` snapshot measures the box where it is painted
     * (`updateSnapshot` → `measure`, create-projection-node.ts 967-979,
     * 1080-1101 @ v14.7.1), so the slide carries on from there. It must not
     * jump to either end.
     *
     * `window.run()` records `[ms since the click, left, top, height]` once
     * per painted frame into `window.samples` for 1.5 s.
     */
    type Sample = [number, number, number, number]
    type ReflowWindow = Window & { samples: Sample[]; run: () => Promise<Sample[]> }

    const transition = { duration: 1, ease: 'linear' } as const
    /** When, after the click, the content grows. */
    const reflowAt = 400

    let moved = $state(false)
    let tall = $state(false)

    let isTester = $state(false)
    let verdict = $state<{ state: 'waiting' | 'running' } | { state: 'done'; maxStep: number }>({
        state: 'waiting'
    })

    const run = () =>
        new Promise<Sample[]>((resolve) => {
            moved = false
            tall = false
            // Let the reset settle before the measured move.
            setTimeout(() => {
                const box = document.getElementById('box')!
                const samples: Sample[] = []
                ;(window as unknown as ReflowWindow).samples = samples
                const start = performance.now()
                const stop = onPaintedFrame(() => {
                    const rect = box.getBoundingClientRect()
                    samples.push([performance.now() - start, rect.left, rect.top, rect.height])
                })
                moved = true
                setTimeout(() => (tall = true), reflowAt)
                setTimeout(() => {
                    stop()
                    resolve(samples)
                }, 1500)
            }, 1200)
        })

    const maxLeftStep = (samples: Sample[]) => {
        let max = 0
        for (let i = 1; i < samples.length; i++) {
            max = Math.max(max, Math.abs(samples[i][1] - samples[i - 1][1]))
        }
        return max
    }

    const runTester = async () => {
        verdict = { state: 'running' }
        const samples = await run()
        verdict = { state: 'done', maxStep: maxLeftStep(samples) }
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        ;(window as unknown as ReflowWindow).run = run
    })

    const steps: TesterStep[] = [
        {
            text: 'Click "Move" and watch the blue box.',
            expected:
                'It slides 400px right over one second. Part-way through it grows a little taller, and it keeps sliding from where it is. It never jumps to the right end or back to the left.',
            action: { label: 'Move', run: runTester }
        }
    ]
</script>

<svelte:head>
    <title>Layout · a reflow mid a layout animation keeps the slide</title>
</svelte:head>

<div class="fixture">
    <motion.div
        id="box"
        layout
        {transition}
        style={{ marginLeft: moved ? '400px' : '0px', width: '100px', background: 'blue' }}
    >
        <div id="content" style:height={tall ? '60px' : '50px'}></div>
    </motion.div>
</div>

<TesterPanel eyebrow="Plan 012 A6" title="A reflow mid a layout animation keeps the slide" {steps}>
    {#snippet summary()}
        {#if isTester}
            {#if verdict.state === 'done'}
                <span class="verdict {verdict.maxStep < 20 ? 'ok' : 'bad'}">
                    {verdict.maxStep < 20 ? 'SMOOTH ✓' : 'JUMPED ✗'}
                </span>
                <span>largest step: {Math.round(verdict.maxStep)}px</span>
            {:else}
                <span class="verdict na"
                    >{verdict.state === 'running' ? 'RECORDING' : 'WAITING'}</span
                >
            {/if}
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The box is a plain <code>layout</code> element (no <code>layoutId</code>) that slides
            400px over one second, linearly. {reflowAt} ms in, its content grows from 50px to 60px tall,
            which its ResizeObserver commits as a layout change. The page records its painted left edge
            every frame: no frame may step 20px or more (a linear slide steps about 7px per frame).
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        position: relative;
        width: 700px;
        padding: 40px 0;
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
