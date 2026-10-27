<script lang="ts">
    import { animate, cancelFrame, frame, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Changing the speed of an accelerated transform animation, or pausing and
     * playing it, keeps it on the compositor without a jump. A Svelte port of
     * upstream's fixture
     * `dev/html/public/playwright/animate/animate-independent-transforms.html`
     * @ `v14.7.1`, driven by `e2e/independent-transforms/speed-change.spec.ts`
     * (a port of three tests in `tests/animate/independent-transforms-handoff.spec.ts`).
     *
     * Motion 14.7 changes speed with `updatePlaybackRate()` (`ccdd9da35`):
     * setting `playbackRate` and `startTime` restarted a compositor animation,
     * which could render the underlying value (the element back at `x = 0`) for
     * one frame. `b58283208` / `dc23e95f8` fixed WebKit ready-time cases.
     *
     * Svelte deviation: besides upstream's plain `#a`, the page has a
     * svelte-motion `motion.div` (`#m`), so `animate(element, { x })` on a
     * motion component's element (which animates its VisualElement) is
     * covered too. Upstream's second plain box `#b` isn't used by these tests
     * and is left out.
     */
    type Frame = {
        t: number
        ts: number
        x: number
        y: number
        scale: number
        rotate: number
        count: number
    }
    type FrameWindow = Window & {
        Motion: { animate: typeof animate; frame: typeof frame; cancelFrame: typeof cancelFrame }
        wait: (ms: number) => Promise<void>
        readTransform: (element: Element) => Omit<Frame, 't' | 'ts' | 'count'>
        transformAnimations: (element: Element) => Animation[]
        recordFrames: (element: Element, ms: number) => Promise<Frame[]>
        ready: boolean
    }

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    const readTransform = (element: Element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return {
            x: matrix.m41,
            y: matrix.m42,
            scale: Math.hypot(matrix.a, matrix.b),
            rotate: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
        }
    }

    const transformAnimations = (element: Element) =>
        element
            .getAnimations()
            .filter((animation) =>
                (animation.effect as KeyframeEffect)
                    .getKeyframes()
                    .some((keyframe) => 'transform' in keyframe)
            )

    /**
     * Record the element's transform after Motion renders, every frame. `t` is
     * the document timeline's time, which WAAPI animations are sampled at, and
     * `ts` is Motion's frame timestamp, which JS animations are sampled at.
     */
    const recordFrames = (element: Element, ms: number) =>
        new Promise<Frame[]>((resolve) => {
            const frames: Frame[] = []
            const start = performance.now()
            const record = ({ timestamp }: { timestamp: number }) => {
                frames.push({
                    t: document.timeline.currentTime as number,
                    ts: timestamp,
                    ...readTransform(element),
                    count: transformAnimations(element).length
                })
                if (performance.now() - start >= ms) {
                    cancelFrame(record)
                    resolve(frames)
                }
            }
            frame.postRender(record, true)
        })

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    const tolerance = 2.5
    const timeOf = (f: Frame) => (f.count ? f.t : f.ts)
    type Verdict =
        | { state: 'idle' }
        | { state: 'running' }
        | { state: 'ok' }
        | { state: 'bad'; detail: string }
    let isTester = $state(false)
    let verdicts = $state<Record<string, Verdict>>({ a: { state: 'idle' }, m: { state: 'idle' } })

    /** `expectSteady` as a boolean: the first frame (index) that isn't, or -1. */
    const unsteadyAt = (frames: Frame[], speed: number) => {
        for (let i = 1; i < frames.length; i++) {
            const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
            const dx = frames[i].x - frames[i - 1].x
            if (Math.abs(dx - speed * dt) >= tolerance) return i
        }
        return -1
    }

    /** Speed segments to check: [from index, to index, px per ms]. */
    type Segments = (frames: Frame[]) => [number, number, number][] | string

    const speedSegments: Segments = (frames) => {
        const changed = frames.findIndex(
            (f, i) => i > 0 && (f.x - frames[i - 1].x) / (f.t - frames[i - 1].t) > 0.3
        )
        if (changed <= 2) return `speed change not seen (frame ${changed})`
        return [
            [0, changed, 0.2],
            [changed, frames.length, 0.4]
        ]
    }

    const pauseSegments: Segments = (frames) => {
        const paused = frames.findIndex((f, i) => i > 0 && Math.abs(f.x - frames[i - 1].x) < 0.01)
        const resumed = frames.findIndex((f, i) => i > paused && f.x - frames[i - 1].x > 0.01)
        if (paused <= 2 || resumed <= paused + 5) return 'pause not seen'
        return [
            [0, paused - 1, 0.2],
            [paused - 1, resumed, 0],
            [resumed, frames.length, 0.2]
        ]
    }

    const judge = (frames: Frame[], segments: Segments): Verdict => {
        const bad = frames.findIndex((f) => f.count !== 1)
        if (bad >= 0)
            return {
                state: 'bad',
                detail: `frame ${bad}: ${frames[bad].count} transform animations`
            }
        const ranges = segments(frames)
        if (typeof ranges === 'string') return { state: 'bad', detail: ranges }
        for (const [from, to, speed] of ranges) {
            const i = unsteadyAt(frames.slice(from, to), speed)
            if (i >= 0) {
                const f = frames[from + i]
                const p = frames[from + i - 1]
                return {
                    state: 'bad',
                    detail: `frame ${from + i}: moved ${(f.x - p.x).toFixed(2)}px in ${(timeOf(f) - timeOf(p)).toFixed(1)}ms`
                }
            }
        }
        return { state: 'ok' }
    }

    const scenarios = {
        speed: async (element: Element) => {
            const animation = animate(element, { x: [0, 600] }, { duration: 3, ease: 'linear' })
            await wait(300)
            const recording = recordFrames(element, 800)
            await wait(400)
            animation.speed = 2
            const frames = await recording
            animation.stop()
            return judge(frames, speedSegments)
        },
        pause: async (element: Element) => {
            const animation = animate(element, { x: [0, 600] }, { duration: 3, ease: 'linear' })
            await wait(300)
            const recording = recordFrames(element, 1000)
            await wait(300)
            animation.pause()
            await wait(300)
            animation.play()
            const frames = await recording
            animation.stop()
            return judge(frames, pauseSegments)
        },
        pauseSpeed: async (element: Element) => {
            const animation = animate(element, { x: [0, 600] }, { duration: 3, ease: 'linear' })
            await wait(200)
            animation.pause()
            await wait(100)
            animation.play()
            await wait(100)
            const recording = recordFrames(element, 800)
            await wait(400)
            animation.speed = 2
            const frames = await recording
            animation.stop()
            return judge(frames, speedSegments)
        }
    }

    const run = (scenario: keyof typeof scenarios) => {
        for (const id of ['a', 'm']) {
            const element = document.getElementById(id)
            if (!element) continue
            verdicts[id] = { state: 'running' }
            void scenarios[scenario](element).then((verdict) => (verdicts[id] = verdict))
        }
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        const w = window as unknown as FrameWindow
        w.Motion = { animate, frame, cancelFrame }
        w.wait = wait
        w.readTransform = readTransform
        w.transformAnimations = transformAnimations
        w.recordFrames = recordFrames
        w.ready = true
    })

    const steps: TesterStep[] = [
        {
            text: 'Run "Speed ×2".',
            expected:
                'Both boxes slide right; 0.7 s in they speed up, with no flicker back to the left edge. Check the flicker by eye: the verdict reads the main-thread value and can’t see a compositor flash (e2e/independent-transforms/speed-change.spec.ts checks it automatically with a screencast).',
            action: { label: 'Speed ×2', run: () => run('speed') }
        },
        {
            text: 'Run "Pause / play".',
            expected: 'They stop for 0.3 s and carry on from the same place.',
            action: { label: 'Pause / play', run: () => run('pause') }
        },
        {
            text: 'Run "Pause, play, then ×2".',
            expected: 'No flicker at the speed change.',
            action: { label: 'Pause, play, then ×2', run: () => run('pauseSpeed') }
        }
    ]

    const label = (verdict: Verdict) =>
        verdict.state === 'ok'
            ? 'STEADY ✓'
            : verdict.state === 'bad'
              ? 'JUMP ✗'
              : verdict.state === 'running'
                ? 'RECORDING'
                : 'WAITING'
</script>

<svelte:head>
    <title>Independent transforms · changing an accelerated animation's speed</title>
</svelte:head>

<div class="fixture">
    <div id="a" class="box"></div>
    <motion.div id="m" class="box" />
</div>

<TesterPanel
    eyebrow="Motion 14.7 · ccdd9da35"
    title="Changing an accelerated animation's speed doesn't flash"
    status="Fixed by Motion 14.7 (updatePlaybackRate)."
    {steps}
>
    {#snippet summary()}
        {#if isTester}
            {#each [['a', 'plain'], ['m', 'motion']] as [id, name] (id)}
                {@const v = verdicts[id]}
                <span class="verdict {v.state === 'ok' ? 'ok' : v.state === 'bad' ? 'bad' : 'na'}">
                    {name}: {label(v)}
                </span>
            {/each}
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The top box is a plain <code>div</code>, the bottom one a <code>motion.div</code>. Each
            action runs <code>animate(box, &#123; x: [0, 600] &#125;)</code> over 3 s on the compositor
            and then changes its speed or pauses it, recording the box after every Motion frame.
        </p>
        <p>
            A verdict is <code>STEADY ✓</code> when every frame moved at the expected speed (within
            2.5 px) and the box stayed one <code>transform</code> animation throughout.
        </p>
        {#each ['a', 'm'] as id (id)}
            {#if verdicts[id].state === 'bad'}
                {@const v = verdicts[id]}
                <p><code>#{id}</code>: {v.state === 'bad' ? v.detail : ''}</p>
            {/if}
        {/each}
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        position: fixed;
        top: 0;
        left: 0;
        margin: 0;
        padding: 0;
    }

    .fixture :global(.box) {
        width: 100px;
        height: 100px;
        background-color: #0077ff;
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
