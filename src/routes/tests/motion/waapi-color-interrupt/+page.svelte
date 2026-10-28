<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import { onPaintedFrame } from '../../independent-transforms/_paintedFrames'

    /**
     * Interrupting a `backgroundColor` animation halfway (by animating back to
     * the start colour) should continue from the colour on screen. It jumped
     * while `backgroundColor` ran on WAAPI, where the browser interpolates in
     * sRGB with premultiplied alpha while Motion estimated the interrupted
     * colour from a JS copy mixing in linear space.
     *
     * A Svelte port of upstream's `dev/react/src/tests/waapi-color-interrupt.tsx`
     * @ `v14.7.1` (commits `71465b139`, `f9e080f21` — `backgroundColor` removed
     * from `acceleratedValues`, so colours run in JS — and `05302644b`), driven
     * by `e2e/motion/waapi-color-interrupt.spec.ts` (a port of
     * `tests/react/waapi-color-interrupt.spec.ts`).
     *
     * Every painted frame's colour is logged to `window.colorFrames` as
     * `[document.timeline.currentTime, computed backgroundColor]`, and the
     * interrupt time to `window.interruptedAt`.
     *
     * Svelte deviations: frames are recorded with `onPaintedFrame` (once per
     * rendered frame, after Motion's frameloop) instead of a rAF loop, timed by
     * the frame's timeline time as upstream's rAF `timestamp` is. The box only
     * renders after `onMount` has read `from` / `to`, so its animation can't
     * start before the recorder.
     */
    type ColorFrame = [number, string]
    type FrameWindow = Window & {
        colorFrames: ColorFrame[]
        interruptedAt: number
        colorAnimations: () => number
    }

    let ready = $state(false)
    let from = $state('rgb(255, 0, 0)')
    let target = $state('rgb(0, 0, 255)')

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { state: 'recording' } | { state: 'ok' } | { state: 'bad'; jump: string }
    let isTester = $state(false)
    let verdict = $state<Verdict>({ state: 'recording' })

    /** Premultiplied [r, g, b, a], all 0-255, of a computed rgb()/rgba() colour. */
    function premultiplied(color: string) {
        const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number)
        return [r * a, g * a, b * a, a * 255]
    }

    /** The spec's jump detector: steps around the interrupt far faster than either neighbour. */
    function findJumps(frames: ColorFrame[], interruptedAt: number) {
        const values = frames.map(([, color]) => premultiplied(color))
        const rates = values.slice(1).map((value, i) => {
            const elapsed = frames[i + 1][0] - frames[i][0]
            let rate = 0
            for (let c = 0; c < 4; c++) {
                const delta = Math.abs(value[c] - values[i][c])
                rate = Math.max(rate, delta / elapsed)
            }
            return rate
        })
        const jumps: string[] = []
        for (let i = 1; i < rates.length - 1; i++) {
            const t = frames[i + 1][0] - interruptedAt
            if (t < -50 || t > 150) continue
            const neighbours = Math.max(rates[i - 1], rates[i + 1])
            if (rates[i] > 3 * neighbours + 0.3) {
                jumps.push(`${frames[i][1]} -> ${frames[i + 1][1]}`)
            }
        }
        return jumps
    }

    onMount(() => {
        const params = new URLSearchParams(window.location.search)
        from = params.get('from') || 'rgb(255, 0, 0)'
        target = params.get('to') || 'rgb(0, 0, 255)'
        isTester = !window.location.search.includes('@isPlaywright=true')

        const w = window as unknown as FrameWindow
        const frames: ColorFrame[] = []
        w.colorFrames = frames
        w.colorAnimations = () =>
            document
                .getElementById('box')
                ?.getAnimations()
                .filter((animation) =>
                    (animation.effect as KeyframeEffect)
                        .getKeyframes()
                        .some(
                            (keyframe) =>
                                'backgroundColor' in keyframe || 'background-color' in keyframe
                        )
                ).length ?? 0

        let interrupt = 0
        let finish = 0
        let mounted = false
        const stop = onPaintedFrame(() => {
            const box = document.getElementById('box')
            if (!box) return
            const now = document.timeline.currentTime as number
            frames.push([now, getComputedStyle(box).backgroundColor])
            if (mounted) return
            mounted = true
            interrupt = window.setTimeout(() => {
                w.interruptedAt = document.timeline.currentTime as number
                target = from
            }, 550)
            finish = window.setTimeout(() => {
                stop()
                if (!isTester) return
                const jumps = findJumps(frames, w.interruptedAt)
                verdict = jumps.length ? { state: 'bad', jump: jumps[0] } : { state: 'ok' }
            }, 1900)
        })
        ready = true

        return () => {
            stop()
            clearTimeout(interrupt)
            clearTimeout(finish)
        }
    })

    const steps: TesterStep[] = [
        {
            text: 'Reload and watch the box.',
            expected:
                'It fades from red towards blue, then about halfway turns back to red smoothly, with no flash or sudden step in colour.',
            action: { label: 'Reload', run: () => window.location.reload() }
        },
        {
            text: 'Open ?from=rgba(255,0,0,0.2)&to=rgb(0,0,255).',
            expected: 'Same, starting from a faint red.',
            action: {
                label: 'Open',
                run: () => {
                    window.location.search = `?from=${encodeURIComponent('rgba(255,0,0,0.2)')}&to=${encodeURIComponent('rgb(0,0,255)')}`
                }
            }
        }
    ]
</script>

<svelte:head>
    <title>Motion · interrupted backgroundColor animation</title>
</svelte:head>

{#if ready}
    <motion.div
        id="box"
        initial={{ backgroundColor: from }}
        animate={{ backgroundColor: target }}
        transition={{ duration: 1, ease: 'linear' }}
        style={{ width: '100px', height: '100px' }}
    />
{/if}

<TesterPanel
    eyebrow="Motion 14.7 · f9e080f21"
    title="An interrupted colour animation continues from the colour on screen"
    status="Fixed by Motion 14.7 (backgroundColor runs in JS)."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict.state === 'ok' ? 'ok' : verdict.state === 'bad' ? 'bad' : 'na'}"
        >
            {verdict.state === 'ok' ? 'SMOOTH ✓' : verdict.state === 'bad' ? 'JUMP ✗' : 'RECORDING'}
        </span>
        {#if verdict.state === 'bad'}
            <code class="detail">{verdict.jump}</code>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The box animates <code>backgroundColor</code> for 1 s and is sent back to its start colour
            550 ms in. The page records the painted colour every frame; a jump is one frame-to-frame change
            far faster than the frames either side of it, within 50 ms before to 150 ms after the interrupt.
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
