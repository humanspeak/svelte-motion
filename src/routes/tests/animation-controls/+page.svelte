<script lang="ts">
    import { motion, useAnimationControls } from '$lib'

    const controls = useAnimationControls()

    let status = $state('idle')
    let runCount = $state(0)
    let sequenceId = 0
    const hydrated = true

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

    const transition = { duration: 0.45, ease: 'easeOut' } as const

    const runSequence = async () => {
        const id = ++sequenceId
        runCount += 1
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
                <button type="button" data-testid="stop" onclick={stop}>Stop</button>
                <button type="button" data-testid="set" onclick={setComplete}>Set complete</button>
                <button type="button" data-testid="reset" onclick={reset}>Reset</button>
            </div>
        </div>

        <div class="stage" data-testid="stage" data-hydrated={hydrated}>
            <motion.div
                class="card"
                data-testid="card"
                initial="idle"
                animate={controls}
                variants={cardVariants}
                {transition}
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
                <span data-testid="run-count">runs: {runCount}</span>
            </motion.div>
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
        place-items: center;
        border: 1px solid #263844;
        background:
            linear-gradient(90deg, rgba(125, 211, 252, 0.12) 1px, transparent 1px),
            linear-gradient(0deg, rgba(125, 211, 252, 0.12) 1px, transparent 1px), #0b1116;
        background-size: 48px 48px;
        overflow: hidden;
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
