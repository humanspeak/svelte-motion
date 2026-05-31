<script lang="ts">
    import { Check, Pause, Play, RotateCcw, Wand2 } from '@lucide/svelte'
    import { motion, useAnimationControls } from '@humanspeak/svelte-motion'

    const controls = useAnimationControls()

    let state = $state<'ready' | 'launching' | 'verified' | 'paused'>('ready')
    let count = $state(0)

    const shell = {
        ready: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
        launch: { x: 72, y: -8, scale: 1.04, rotate: 2, opacity: 1 },
        verified: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
    }

    const beam = {
        ready: { scaleX: 0.16, opacity: 0.35 },
        launch: { scaleX: 1, opacity: 1 },
        verified: { scaleX: 0.66, opacity: 0.7 }
    }

    const badge = {
        ready: { scale: 0.86, opacity: 0.55, rotate: -8 },
        launch: { scale: 1.18, opacity: 1, rotate: 8 },
        verified: { scale: 1, opacity: 1, rotate: 0 }
    }

    const text = {
        ready: { opacity: 0.66 },
        launch: { opacity: 1 },
        verified: { opacity: 1 }
    }

    const run = async () => {
        count += 1
        state = 'launching'
        await controls.start('launch', { duration: 0.55, ease: 'easeOut' })
        state = 'verified'
        await controls.start('verified', { duration: 0.42, ease: 'easeInOut' })
    }

    const setVerified = () => {
        count += 1
        state = 'verified'
        controls.set('verified')
    }

    const stop = () => {
        state = 'paused'
        controls.stop()
    }

    const reset = () => {
        state = 'ready'
        controls.set('ready')
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="Animation controls">
        <button type="button" class="primary" onclick={run} aria-label="Start sequence">
            <Play size={15} />
            Start
        </button>
        <button type="button" onclick={stop} aria-label="Stop animation">
            <Pause size={15} />
            Stop
        </button>
        <button type="button" onclick={setVerified} aria-label="Set verified">
            <Check size={15} />
            Set
        </button>
        <button type="button" onclick={reset} aria-label="Reset">
            <RotateCcw size={15} />
            Reset
        </button>
    </div>

    <div class="stage">
        <motion.div class="ship" initial="ready" animate={controls} variants={shell}>
            <div class="ship-top">
                <Wand2 size={24} />
                <motion.div class="status" initial="ready" animate={controls} variants={text}>
                    {state}
                </motion.div>
            </div>
            <motion.div class="beam" initial="ready" animate={controls} variants={beam} />
            <div class="ship-bottom">
                <span>run {count}</span>
                <motion.div class="badge" initial="ready" animate={controls} variants={badge}>
                    <Check size={18} />
                </motion.div>
            </div>
        </motion.div>
    </div>
</div>

<style>
    .dk-demo-shell {
        min-height: 480px;
        display: grid;
        place-items: center;
        gap: 18px;
        padding: 2rem;
        background: #0e1419;
        color: #eef6fb;
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }

    button {
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 12px;
        border: 1px solid #405767;
        border-radius: 6px;
        background: #151f27;
        color: #eef6fb;
        font-size: 13px;
        font-weight: 750;
        cursor: pointer;
    }

    button.primary {
        border-color: #67e8f9;
        background: #0e7490;
    }

    .stage {
        width: min(100%, 560px);
        height: 320px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid #273945;
        background:
            radial-gradient(circle at 28% 48%, rgba(103, 232, 249, 0.14), transparent 34%),
            linear-gradient(90deg, rgba(103, 232, 249, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(103, 232, 249, 0.1) 1px, transparent 1px), #0a1015;
        background-size:
            auto,
            42px 42px,
            42px 42px,
            auto;
    }

    :global(.ship) {
        width: 230px;
        min-height: 144px;
        display: grid;
        gap: 14px;
        padding: 18px;
        border: 1px solid #547082;
        border-radius: 8px;
        background: #121d25;
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.32);
        transform-origin: 50% 50%;
    }

    .ship-top,
    .ship-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    :global(.status) {
        color: #f9a8d4;
        font-size: 23px;
        font-weight: 850;
        letter-spacing: 0;
    }

    :global(.beam) {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, #67e8f9, #f9a8d4);
        transform-origin: 0 50%;
    }

    .ship-bottom span {
        color: #93a7b6;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        text-transform: uppercase;
    }

    :global(.badge) {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: #083344;
        color: #67e8f9;
        border: 1px solid #155e75;
    }
</style>
