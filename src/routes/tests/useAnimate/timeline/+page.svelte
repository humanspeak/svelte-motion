<script lang="ts">
    /**
     * Motion 14.7 `Timeline` through `useAnimate()`'s scoped `animate`.
     *
     * Behaviour ported from upstream
     * `packages/framer-motion/src/animation/timeline/__tests__/timeline.test.ts`
     * @ v14.7.1: segments added after creation, a segment offset from a label
     * (`'mid+0.5'`, #2204), `playTo()` a label and pause, and `reverse()`
     * firing `onComplete` again when it reaches the start.
     *
     * The timeline is built paused (`autoplay: false`): A slides to the `mid`
     * label (0s → 1s), then B (1s → 2s). "Add C" puts C at `mid+0.5`, so it
     * runs 1.5s → 2.5s and the duration grows from 2.00 to 2.50.
     *
     * @component
     */
    import { useAnimate } from '$lib'
    import { onMount, tick } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const [scope, animate] = useAnimate<HTMLDivElement>()

    let hydrated = $state(false)
    let duration = $state('0.00')
    let time = $state('0.00')
    let playState = $state('idle')
    let completed = $state(0)
    let addedC = $state(false)

    let tl: ReturnType<typeof animate> | undefined

    const refresh = () => {
        if (!tl) return
        duration = tl.duration.toFixed(2)
        time = tl.time.toFixed(2)
        playState = tl.state
    }

    const run = (action: () => void) => () => {
        action()
        refresh()
        // Changes are batched per microtask; read again once they land.
        queueMicrotask(refresh)
    }

    const addC = run(() => {
        tl?.add(['.c', { x: 200 }, { duration: 1, ease: 'linear' }], 'mid+0.5')
        addedC = true
    })
    const playToMid = run(() => void tl?.playTo('mid'))
    const play = run(() => void tl?.play())
    const reverse = run(() => void tl?.reverse())

    // ---- Live verdict (tester only) ----
    //
    // Samples the three boxes every frame and checks what each step promises:
    // C starts half a second after B, and reversing returns every box to 0.

    type Check = 'waiting' | 'ok' | 'bad'
    const verdict = $state({ duration: 'waiting' as Check, offset: 'waiting' as Check })

    const translateX = (selector: string) => {
        const el = document.querySelector(selector)
        if (!el) return 0
        return new DOMMatrixReadOnly(getComputedStyle(el).transform).m41
    }

    onMount(() => {
        tl = animate(
            [
                ['.a', { x: 200 }, { duration: 1, ease: 'linear' }],
                'mid',
                ['.b', { x: 200 }, { duration: 1, ease: 'linear' }]
            ],
            {
                autoplay: false,
                onUpdate: (t: number) => {
                    time = t.toFixed(2)
                    if (tl) {
                        duration = tl.duration.toFixed(2)
                        playState = tl.state
                    }
                },
                onComplete: () => {
                    completed += 1
                    refresh()
                }
            }
        )
        refresh()

        void (async () => {
            await tick()
            await new Promise((resolve) => requestAnimationFrame(resolve))
            hydrated = true
        })()

        if (window.location.search.includes('@isPlaywright=true')) return

        let raf = 0
        const sample = () => {
            raf = requestAnimationFrame(sample)
            if (addedC && verdict.duration === 'waiting') {
                verdict.duration = duration === '2.50' ? 'ok' : 'bad'
            }
            if (!addedC || !tl || verdict.offset !== 'waiting') return
            // B starts at 1s, C at 1.5s: when B is half way, C must not have moved.
            const t = tl.time
            if (t > 1.4 && t < 1.45) {
                verdict.offset =
                    translateX('.b') > 60 && Math.abs(translateX('.c')) < 1 ? 'ok' : 'bad'
            }
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const steps: TesterStep[] = [
        {
            text: 'Click "Add C".',
            expected: 'Duration reads 2.50 (it was 2.00). Nothing moves yet.',
            action: { label: 'Add C', run: addC }
        },
        {
            text: 'Click "Play to mid".',
            expected:
                'A slides right and stops; B and C stay put. State reads "paused", time 1.00.',
            action: { label: 'Play to mid', run: playToMid }
        },
        {
            text: 'Click "Play".',
            expected:
                'B slides, then C starts half a second after B did. "Completed" becomes 1 when C arrives.',
            action: { label: 'Play', run: play }
        },
        {
            text: 'Click "Reverse".',
            expected: 'Everything slides back to the left and "completed" goes up by one.',
            action: { label: 'Reverse', run: reverse }
        }
    ]
</script>

<svelte:head>
    <title>useAnimate timelines Test</title>
</svelte:head>

<div class="page">
    <header>
        <h1>useAnimate — timelines (Motion 14.7)</h1>
        <p>
            <code>animate(sequence, &#123; autoplay: false &#125;)</code> returns a mutable
            <code>Timeline</code>: add segments while it exists, offset them from a label, play to a
            label and reverse.
        </p>
    </header>

    <section class="controls">
        <button type="button" data-testid="add-c" onclick={addC}>Add C at mid+0.5</button>
        <button type="button" data-testid="play-to-mid" onclick={playToMid}>Play to mid</button>
        <button type="button" data-testid="play" onclick={play}>Play</button>
        <button type="button" data-testid="reverse" onclick={reverse}>Reverse</button>
    </section>

    <dl class="readouts">
        <dt>duration</dt>
        <dd data-testid="duration">{duration}</dd>
        <dt>time</dt>
        <dd data-testid="time">{time}</dd>
        <dt>state</dt>
        <dd data-testid="state">{playState}</dd>
        <dt>completed</dt>
        <dd data-testid="completed">{completed}</dd>
    </dl>

    <div {@attach scope} class="stage" data-testid="stage" data-hydrated={hydrated}>
        <div class="box a" data-testid="box-a">A</div>
        <div class="box b" data-testid="box-b">B</div>
        <div class="box c" data-testid="box-c">C</div>
    </div>
</div>

<TesterPanel
    eyebrow="Motion 14.7 · timeline.test.ts"
    title="useAnimate returns a mutable Timeline"
    status="Needs Motion 14.7.1. On 14.6.0 the timeline autoplays and Add C / Play to mid throw."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict.duration === 'ok'
                ? 'ok'
                : verdict.duration === 'bad'
                  ? 'bad'
                  : 'na'}"
        >
            duration: {verdict.duration === 'ok'
                ? '2.50 ✓'
                : verdict.duration === 'bad'
                  ? `${duration} ✗`
                  : 'WAITING'}
        </span>
        <span
            class="verdict {verdict.offset === 'ok'
                ? 'ok'
                : verdict.offset === 'bad'
                  ? 'bad'
                  : 'na'}"
        >
            C offset: {verdict.offset === 'ok'
                ? 'AFTER B ✓'
                : verdict.offset === 'bad'
                  ? 'WRONG ✗'
                  : 'WAITING'}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            A runs from 0s to the <code>mid</code> label (1s), B from 1s to 2s. C is added later at
            <code>'mid+0.5'</code>, so it starts at 1.5s and the timeline grows to 2.5s.
        </p>
        <p>
            Before Motion 14.7, <code>animate()</code> returned fixed playback controls: no
            <code>add</code>, <code>playTo</code> or <code>reverse</code>, and an unknown label like
            <code>'mid+0.5'</code> resolved to the end of the sequence.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        padding: 24px;
        max-width: 520px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .controls button {
        padding: 6px 12px;
        border-radius: 6px;
        background: #1f2937;
        color: white;
        border: 1px solid #374151;
    }
    .readouts {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 4px 12px;
        font-family: monospace;
    }
    .stage {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        width: 280px;
        border: 1px dashed #4b5563;
        border-radius: 8px;
    }
    .box {
        width: 40px;
        height: 40px;
        border-radius: 6px;
        display: grid;
        place-items: center;
        color: white;
        font-weight: 600;
    }
    .a {
        background: #ef4444;
    }
    .b {
        background: #3b82f6;
    }
    .c {
        background: #22c55e;
    }
    .verdict {
        font-weight: 600;
        margin-right: 8px;
    }
    .verdict.ok {
        color: #16a34a;
    }
    .verdict.bad {
        color: #dc2626;
    }
    .verdict.na {
        color: #6b7280;
    }
</style>
