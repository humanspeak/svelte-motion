<script lang="ts">
    import { onMount } from 'svelte'
    import { motion, useAnimationControls } from '$lib'
    import type { TransformTemplate } from 'motion-dom'

    /**
     * Isolated failure page for #402, gap 1: `controls.stop()` must stop the
     * separate templated-transform MotionValue animation, not just DOM animations.
     *
     * Eye-verify: click "Send", then "Stop" while the orb is mid-track. With the
     * fix the orb freezes instantly and keeps its `translateY(...)` template. The
     * pre-fix bug let the templated transform keep gliding to the target after Stop.
     */
    const controls = useAnimationControls()

    // A constant lift is prepended around Motion's generated transform so every
    // frame is visibly templated, while keeping the orb inside the track (the lift
    // must NOT scale with x, or a large x would push the orb out of view).
    const transformTemplate: TransformTemplate = (_latest, generated) =>
        `translateY(-22px) ${generated}`.trim()

    let sent = $state(false)
    let inlineStyle = $state('')
    let currentX = $state<number | null>(null)
    let capturedAtStop = $state<number | null>(null)
    let status = $state<'idle' | 'moving' | 'frozen'>('idle')

    const readX = (style: string): number | null => {
        const match = style.match(/translateX\(([-\d.]+)px\)/)
        return match ? Number.parseFloat(match[1]) : null
    }

    function send() {
        capturedAtStop = null
        sent = !sent
        // Slow + linear so there is plenty of track to Stop in the middle of.
        void controls.start({ x: sent ? 320 : 0 }, { duration: 4, ease: 'linear' })
    }

    function stop() {
        controls.stop()
        capturedAtStop = currentX
    }

    function reset() {
        controls.stop()
        capturedAtStop = null
        sent = false
        void controls.start({ x: 0 }, { duration: 0 })
    }

    onMount(() => {
        let raf = 0
        const history: number[] = []

        const tick = () => {
            const element = document.querySelector<HTMLElement>('[data-testid="stop-orb"]')
            if (element) {
                const style = element.getAttribute('style') ?? ''
                inlineStyle = style
                const x = readX(style)
                currentX = x

                // At the origin the templated transform collapses and translateX
                // is omitted — treat an absent offset as 0 so the status can settle
                // to "frozen" instead of sticking on its last sampled value.
                history.push(x ?? 0)
                if (history.length > 8) history.shift()
                const spread = Math.max(...history) - Math.min(...history)
                status = spread > 0.5 ? 'moving' : 'frozen'
            }
            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    })
</script>

<svelte:head>
    <title>transformTemplate — controls.stop() freeze (#402)</title>
</svelte:head>

<main class="page">
    <h1>controls.stop() during a templated transform</h1>
    <p class="expectation">
        Click <strong>Send</strong> to start a slow 4s linear move to <code>x: 320</code>. Click
        <strong>Stop</strong> while the orb is mid-track. It must
        <strong>freeze instantly</strong> and keep <code>translateY(...)</code> in its transform. Bug
        (#402): without the fix the templated transform keeps gliding to the target after Stop.
    </p>

    <div class="track">
        <div class="target" aria-hidden="true">target</div>
        <motion.div
            class="orb"
            data-testid="stop-orb"
            initial={{ x: 0 }}
            animate={controls}
            {transformTemplate}
            controls
        >
            orb
        </motion.div>
    </div>

    <div class="controls">
        <button type="button" data-testid="stop-send" onclick={send}>
            {sent ? 'Send back' : 'Send →'}
        </button>
        <button type="button" data-testid="stop-stop" onclick={stop}>Stop</button>
        <button type="button" data-testid="stop-reset" onclick={reset}>Reset</button>
    </div>

    <dl class="readout">
        <dt>Status</dt>
        <dd
            data-testid="stop-status"
            class:moving={status === 'moving'}
            class:frozen={status === 'frozen'}
        >
            {status.toUpperCase()}
        </dd>
        <dt>translateX</dt>
        <dd data-testid="stop-current-x">{currentX === null ? '—' : `${currentX.toFixed(1)}px`}</dd>
        <dt>captured at Stop</dt>
        <dd data-testid="stop-captured-x">
            {capturedAtStop === null ? '—' : `${capturedAtStop.toFixed(1)}px`}
        </dd>
        <dt>inline style</dt>
        <dd class="mono" data-testid="stop-inline-style">{inlineStyle}</dd>
    </dl>
</main>

<style>
    /* Dark backdrop so the light heading/description text stays readable
       regardless of the app's default (light) page background. */
    :global(body) {
        background: #0a0f1c;
    }
    .page {
        margin: 0 auto;
        min-height: 100vh;
        max-width: 720px;
        padding: 2rem 1rem;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }
    h1 {
        font-size: 1.4rem;
        font-weight: 600;
    }
    .expectation {
        margin: 0.5rem 0 1.5rem;
        color: #cbd5e1;
        line-height: 1.5;
    }
    code {
        background: #1e293b;
        padding: 0.05rem 0.3rem;
        border-radius: 0.25rem;
    }
    .track {
        position: relative;
        height: 120px;
        border: 1px dashed #334155;
        border-radius: 0.5rem;
        background: #0b1220;
        overflow: hidden;
    }
    .target {
        position: absolute;
        top: 50%;
        left: 360px;
        translate: 0 -50%;
        color: #64748b;
        font-size: 0.75rem;
        border-left: 2px dotted #475569;
        padding-left: 0.4rem;
        height: 60px;
        display: flex;
        align-items: center;
    }
    /* Scoped classes don't pierce into the <motion.div> component's rendered
       element, so the orb styles must be global to take effect. */
    :global(.track .orb) {
        position: absolute;
        top: 50%;
        left: 16px;
        translate: 0 -50%;
        width: 56px;
        height: 56px;
        border-radius: 0.6rem;
        background: linear-gradient(135deg, #ec4899, #8b5cf6);
        display: grid;
        place-items: center;
        font-size: 0.75rem;
        color: white;
    }
    .controls {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0;
    }
    button {
        background: #1d4ed8;
        color: white;
        border: 0;
        border-radius: 0.4rem;
        padding: 0.45rem 0.9rem;
        font-size: 0.85rem;
        cursor: pointer;
    }
    button:hover {
        background: #2563eb;
    }
    .readout {
        display: grid;
        grid-template-columns: 10rem 1fr;
        gap: 0.35rem 1rem;
        background: #0b1220;
        border: 1px solid #1e293b;
        border-radius: 0.5rem;
        padding: 1rem;
        font-size: 0.85rem;
    }
    .readout dt {
        color: #94a3b8;
    }
    .readout dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
    }
    .readout dd.mono {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
        word-break: break-all;
        color: #cbd5e1;
        /* Reserve two lines so the row height never jumps as the live transform
           string grows/shrinks each frame. */
        min-height: 2.4em;
    }
    .readout dd.moving {
        color: #f87171;
        font-weight: 700;
    }
    .readout dd.frozen {
        color: #34d399;
        font-weight: 700;
    }
</style>
