<script lang="ts">
    import { motion, useAnimationControls } from '$lib'
    import { onMount, tick } from 'svelte'

    const controls = useAnimationControls()

    let status = $state('idle')
    let runCount = $state(0)
    let sequenceId = 0
    let hydrated = $state(false)
    let frame = $state(0)
    // Unrelated reactive style channel used to force a `renderedInlineStyle`
    // recompute after `controls.stop()` — the moment a stale settle state
    // would rewrite the frozen transform.
    let pokeOutline = $state('transparent')
    // Chooses which `animate` source the beam receives: the shared controls
    // object, or a declarative literal. Swapping controls → declarative →
    // controls exercises detach/re-attach; upstream is last-writer-wins per
    // motion value, so a re-attached IDLE controls object must not resurrect a
    // stale imperative target.
    let beamUsesControls = $state(true)
    let cardTransform = $state('none')
    let cardOpacity = $state('')
    let orbTransform = $state('none')
    let orbOpacity = $state('')
    let labelTransform = $state('none')
    let labelOpacity = $state('')
    let beamScaleX = $state('0.16')
    // First-start sweep trace (plan 002's fix made this visible): on a Start
    // click the beam must SWEEP 0.16→1 continuously. The trace samples scaleX
    // per frame for ~1.2s and the verdict flags any single-frame jump — the
    // regression was a teleport (0.16 held ~100ms, then 1 in one frame).
    let beamTrace = $state('—')
    let beamVerdict = $state('—')
    let firstStartArmed = true

    const readBeamScaleX = (): number => {
        const el = document.querySelector<HTMLElement>('[data-testid="beam"]')
        if (!el) return Number.NaN
        const t = getComputedStyle(el).transform
        if (!t || t === 'none') return 1
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return 1
        const [a, b] = m[1].split(',').map((v) => Number.parseFloat(v.trim()))
        return Math.hypot(a, b)
    }

    const recordBeamTrace = (label: string) => {
        const samples: number[] = []
        const started = performance.now()
        const wasFirst = firstStartArmed
        firstStartArmed = false
        const sample = () => {
            samples.push(readBeamScaleX())
            if (performance.now() - started < 1200) {
                requestAnimationFrame(sample)
                return
            }
            const finite = samples.filter(Number.isFinite)
            let maxJump = 0
            let jumpAt = -1
            for (let i = 1; i < finite.length; i++) {
                const step = Math.abs(finite[i] - finite[i - 1])
                if (step > maxJump) {
                    maxJump = step
                    jumpAt = i
                }
            }
            const condensed = [0, 4, 8, 14, 22, finite.length - 1]
                .filter((i) => i >= 0 && i < finite.length)
                .map((i) => finite[i].toFixed(2))
                .join(' → ')
            beamTrace = `${label}${wasFirst ? ' (FIRST)' : ''}: ${condensed}`
            beamVerdict =
                maxJump > 0.3
                    ? `✗ TELEPORT — ${maxJump.toFixed(2)} in one frame (sample ${jumpAt})`
                    : `✓ smooth sweep — max frame step ${maxJump.toFixed(3)}`
        }
        requestAnimationFrame(sample)
    }

    const cardVariants = {
        idle: { opacity: 1, x: 0, scale: 1, rotate: 0 },
        launch: { opacity: 1, x: 64, scale: 1.08, rotate: 2 },
        success: { opacity: 1, x: 0, scale: 1, rotate: 0 }
    }

    const orbVariants = {
        idle: { opacity: 0.45, scale: 0.9, x: 0 },
        launch: { opacity: 1, scale: 1.3, x: 92 },
        success: { opacity: 0.75, scale: 1.05, x: 0 }
    }

    const labelVariants = {
        idle: { opacity: 0.65, y: 0 },
        launch: { opacity: 1, y: -8 },
        success: { opacity: 1, y: 0 }
    }

    // Ends NON-neutral on purpose: a settle path that wipes the final
    // transform is invisible when every variant returns to identity.
    const beamVariants = {
        idle: { scaleX: 0.16, opacity: 0.35 },
        launch: { scaleX: 1, opacity: 1 },
        success: { scaleX: 0.66, opacity: 0.7 }
    }

    const transition = { duration: 0.45, ease: 'easeOut' } as const

    const runSequence = async () => {
        const id = ++sequenceId
        runCount += 1
        recordBeamTrace('start')
        status = 'launching'
        await controls.start('launch', transition)
        if (id !== sequenceId) return
        status = 'confirming'
        await controls.start('success', { duration: 0.35, ease: 'easeInOut' })
        if (id !== sequenceId) return
        status = 'complete'
    }

    const setComplete = () => {
        sequenceId += 1
        runCount += 1
        status = 'complete'
        controls.set('success')
    }

    const reset = () => {
        sequenceId += 1
        status = 'idle'
        controls.set('idle')
    }

    const stop = () => {
        sequenceId += 1
        status = 'stopped'
        controls.stop()
    }

    // Single slow step (no chaining) so a stop lands cleanly mid-flight with a
    // wide, predictable window. Linear ease keeps the mid value deterministic.
    const startSlowLaunch = () => {
        sequenceId += 1
        recordBeamTrace('start-slow')
        status = 'launching'
        void controls.start('launch', { duration: 2, ease: 'linear' })
    }

    // Wildcard probe (plan 003): `[0, null]` should resolve the trailing null
    // wildcard to the card's live x at animation start. After `start-slow`
    // parks the card at x=64, this animates 0→64 and lands at 64. Linear ease
    // keeps the landing deterministic.
    const probeWildcard = () => {
        sequenceId += 1
        void controls.start({ x: [0, null] }, { duration: 0.3, ease: 'linear' })
    }

    // Leading-wildcard probe: `[null, 100]` fills keyframes[0] from the card's
    // live x (upstream: the ONLY position the live value feeds), so from x=64
    // this animates 64→100 — the true "start from the current value" showcase.
    const probeLeading = () => {
        sequenceId += 1
        void controls.start({ x: [null, 100] }, { duration: 0.3, ease: 'linear' })
    }

    // Relative probe (plan 003): `'+=50'` resolves against the card's live x at
    // animation start. From a fresh idle (x=0) this settles at 50.
    const probeRelative = () => {
        sequenceId += 1
        void controls.start({ x: '+=50' }, { duration: 0.3, ease: 'linear' })
    }

    // Toggle an unrelated inline-style channel on the beam to trigger a
    // reactive style flush without touching any animated channel.
    const poke = () => {
        pokeOutline = pokeOutline === 'transparent' ? 'rgb(255, 0, 255)' : 'transparent'
    }

    // Swap the beam's `animate` source between the controls object and a
    // declarative literal (`{ scaleX: 1 }`), detaching/re-attaching the
    // controls subscription.
    const toggleBeamSource = () => {
        beamUsesControls = !beamUsesControls
    }

    onMount(() => {
        let raf = 0
        let disposed = false
        const readElement = (testId: string) => {
            const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
            if (!element) return { transform: 'missing', opacity: 'missing' }
            const style = getComputedStyle(element)
            return {
                transform: style.transform === 'none' ? 'none' : style.transform,
                opacity: style.opacity
            }
        }

        const tickFrame = () => {
            if (disposed) return
            frame += 1
            const card = readElement('card')
            const orb = readElement('orb')
            const label = readElement('label')
            beamScaleX = Number.isFinite(readBeamScaleX()) ? readBeamScaleX().toFixed(3) : '—'

            cardTransform = card.transform
            cardOpacity = card.opacity
            orbTransform = orb.transform
            orbOpacity = orb.opacity
            labelTransform = label.transform
            labelOpacity = label.opacity

            raf = requestAnimationFrame(tickFrame)
        }

        void (async () => {
            await tick()
            await new Promise((resolve) => requestAnimationFrame(resolve))
            if (disposed) return
            hydrated = true
            raf = requestAnimationFrame(tickFrame)
        })()

        return () => {
            disposed = true
            cancelAnimationFrame(raf)
        }
    })
</script>

<svelte:head>
    <title>useAnimationControls test</title>
</svelte:head>

<main>
    <section class="panel">
        <div class="copy">
            <p class="eyebrow">useAnimationControls</p>
            <h1>One controller, three motion elements.</h1>
            <p>
                The shared controls object is passed to each <code>animate</code> prop.
                <code>start('launch')</code> fans out to every subscriber, awaits them, then
                <code>start('success')</code> runs the next coordinated step.
            </p>
            <div class="controls" aria-label="Animation controls">
                <button type="button" data-testid="start" onclick={runSequence}>Start</button>
                <button type="button" data-testid="start-slow" onclick={startSlowLaunch}
                    >Start slow</button
                >
                <button type="button" data-testid="probe-wildcard" onclick={probeWildcard}
                    >Probe wildcard</button
                >
                <button type="button" data-testid="probe-leading" onclick={probeLeading}
                    >Probe leading</button
                >
                <button type="button" data-testid="probe-relative" onclick={probeRelative}
                    >Probe relative</button
                >
                <button type="button" data-testid="stop" onclick={stop}>Stop</button>
                <button type="button" data-testid="poke" onclick={poke}>Poke</button>
                <button type="button" data-testid="toggle-beam-source" onclick={toggleBeamSource}
                    >Toggle beam source</button
                >
                <button type="button" data-testid="set" onclick={setComplete}>Set complete</button>
                <button type="button" data-testid="reset" onclick={reset}>Reset</button>
            </div>
        </div>

        <div class="stage" data-testid="stage" data-hydrated={hydrated}>
            <dl class="frame-readout" data-testid="animation-controls-readout">
                <div>
                    <dt>frame</dt>
                    <dd>{frame}</dd>
                </div>
                <div>
                    <dt>card</dt>
                    <dd>{cardTransform}</dd>
                </div>
                <div>
                    <dt>card o</dt>
                    <dd>{cardOpacity}</dd>
                </div>
                <div>
                    <dt>orb</dt>
                    <dd>{orbTransform}</dd>
                </div>
                <div>
                    <dt>orb o</dt>
                    <dd>{orbOpacity}</dd>
                </div>
                <div>
                    <dt>label</dt>
                    <dd>{labelTransform}</dd>
                </div>
                <div>
                    <dt>label o</dt>
                    <dd>{labelOpacity}</dd>
                </div>
                <div>
                    <dt>beam sx</dt>
                    <dd>{beamScaleX} (idle 0.16 · launch 1 · success 0.66)</dd>
                </div>
                <div>
                    <dt>trace</dt>
                    <dd>{beamTrace}</dd>
                </div>
                <div class="verdict-row">
                    <dt>verdict</dt>
                    <dd>{beamVerdict}</dd>
                </div>
            </dl>
            <p class="expectation">
                FIRST Start after a hard refresh: the beam (green bar) must SWEEP from skinny
                (scaleX 0.16) to full — the regression teleported it. The trace/verdict rows above
                measure every Start.
            </p>
            <div class="motion-area">
                <motion.div
                    class="card"
                    data-testid="card"
                    initial="idle"
                    animate={controls}
                    variants={cardVariants}
                    {transition}
                    style="outline: 2px solid {pokeOutline};"
                >
                    <motion.div
                        class="orb"
                        data-testid="orb"
                        initial="idle"
                        animate={controls}
                        variants={orbVariants}
                        {transition}
                    />
                    <motion.div
                        class="label"
                        data-testid="label"
                        initial="idle"
                        animate={controls}
                        variants={labelVariants}
                        {transition}
                    >
                        {status}
                    </motion.div>
                    <motion.div
                        class="beam"
                        data-testid="beam"
                        initial="idle"
                        animate={beamUsesControls ? controls : { scaleX: 1 }}
                        variants={beamVariants}
                        style="width: 160px; height: 8px; background: #4ff0b7; transform-origin: 0 50%; outline: 2px solid {pokeOutline};"
                    />
                    <span data-testid="run-count">runs: {runCount}</span>
                </motion.div>
            </div>
        </div>
    </section>
</main>

<style>
    main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
        background: #101418;
        color: #eef4fb;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    .panel {
        width: min(980px, 100%);
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
        gap: 32px;
        align-items: center;
        border: 1px solid #30414d;
        padding: 28px;
    }

    .copy {
        display: grid;
        gap: 14px;
    }

    .eyebrow {
        margin: 0;
        color: #7dd3fc;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0;
    }

    h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.1;
    }

    p {
        margin: 0;
        color: #b7c4ce;
        line-height: 1.6;
    }

    code {
        color: #f9a8d4;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
    }

    button {
        height: 36px;
        padding: 0 12px;
        border: 1px solid #3f5666;
        background: #17212a;
        color: #eef4fb;
        font-weight: 700;
        cursor: pointer;
    }

    button:hover {
        border-color: #7dd3fc;
        background: #1f2d38;
    }

    .stage {
        min-height: 360px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 18px;
        padding: 14px;
        box-sizing: border-box;
        border: 1px solid #263844;
        background:
            linear-gradient(90deg, rgba(125, 211, 252, 0.12) 1px, transparent 1px),
            linear-gradient(0deg, rgba(125, 211, 252, 0.12) 1px, transparent 1px), #0b1116;
        background-size: 48px 48px;
        overflow: hidden;
    }

    .expectation {
        margin: 0;
        padding: 8px 10px;
        border: 1px dashed rgba(79, 240, 183, 0.4);
        color: #4ff0b7;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 11px;
        line-height: 1.45;
    }

    .frame-readout .verdict-row dd {
        color: #4ff0b7;
        font-weight: 800;
    }

    .frame-readout {
        width: 100%;
        height: 244px;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: repeat(10, 1fr);
        gap: 5px;
        margin: 0;
        padding: 10px;
        border: 1px solid rgba(125, 211, 252, 0.26);
        background: rgba(8, 17, 23, 0.86);
        color: #c8f7ff;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
        font-size: 11px;
        line-height: 1.3;
        pointer-events: none;
        overflow: hidden;
    }

    .motion-area {
        min-height: 0;
        display: grid;
        place-items: center;
    }

    .frame-readout div {
        min-width: 0;
        display: grid;
        grid-template-columns: 56px minmax(0, 1fr);
        gap: 8px;
    }

    .frame-readout dt {
        color: #67e8f9;
        font-weight: 800;
        text-transform: uppercase;
    }

    .frame-readout dd {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    :global(.card) {
        width: 240px;
        height: 160px;
        display: grid;
        place-items: center;
        gap: 12px;
        border: 1px solid #4d6677;
        background: #111b23;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
    }

    :global(.orb) {
        width: 56px;
        height: 56px;
        border-radius: 999px;
        background: #7dd3fc;
        box-shadow: 0 0 34px rgba(125, 211, 252, 0.5);
    }

    :global(.label) {
        color: #f9a8d4;
        font-size: 22px;
        font-weight: 800;
    }

    span {
        color: #8ea1af;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }

    @media (max-width: 760px) {
        .panel {
            grid-template-columns: 1fr;
        }

        .stage {
            min-height: 300px;
        }
    }
</style>
