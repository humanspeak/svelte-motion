<script lang="ts">
    import { onMount } from 'svelte'
    import { animate, cancelFrame, frame } from '@humanspeak/svelte-motion'
    import { dialEffect, type Dial } from './dialEffect'

    const dial: Dial = { angle: 45, radius: 64 }

    let canvas = $state<HTMLCanvasElement | null>(null)
    let displayedAngle = $state(45)
    let targetAngle = $state(45)

    const draw = () => {
        if (!canvas) return

        const context = canvas.getContext('2d')
        if (!context) return

        const center = canvas.width / 2
        const endAngle = (dial.angle * Math.PI) / 180

        context.clearRect(0, 0, canvas.width, canvas.height)
        context.beginPath()
        context.arc(center, center, dial.radius, 0, Math.PI * 2)
        context.strokeStyle = '#c8d2ce'
        context.lineWidth = 16
        context.stroke()

        context.beginPath()
        context.arc(center, center, dial.radius, 0, endAngle)
        context.strokeStyle = '#247768'
        context.lineCap = 'round'
        context.lineWidth = 16
        context.stroke()

        displayedAngle = Math.round(dial.angle)
    }

    const setAngle = (event: Event) => {
        targetAngle = Number((event.currentTarget as HTMLInputElement).value)
        animate(dial, { angle: targetAngle }, { duration: 0.35 })
    }

    const openDial = () => {
        targetAngle = 270
        animate(
            dial,
            { angle: targetAngle, radius: 80 },
            { type: 'spring', stiffness: 120, damping: 14 }
        )
    }

    onMount(() => {
        animate.addEffect(dialEffect)
        frame.render(draw, true)

        return () => {
            cancelFrame(draw)
            animate.removeEffect(dialEffect)
        }
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// custom-effect</span>
            <span class="micro readout"> angle <output>{displayedAngle}</output>° </span>
        </div>

        <div class="stage">
            <canvas bind:this={canvas} width="240" height="240"></canvas>
        </div>

        <div class="controls">
            <label class="micro" for="dial-angle">target {targetAngle}°</label>
            <input
                id="dial-angle"
                type="range"
                min="0"
                max="360"
                value={targetAngle}
                oninput={setAngle}
            />
            <button onclick={openDial}>Spring open</button>
        </div>

        <div class="strip-foot">
            <span class="micro">plain object → createEffect → canvas</span>
            <span class="micro">frame.preRender</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 420px;
        padding: 1.5rem;
    }

    .strip {
        display: flex;
        width: 100%;
        max-width: 420px;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        color: var(--brut-ink-3, #9a9a9a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
    }

    .strip-foot {
        padding-top: 0.75rem;
        padding-bottom: 0;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        border-bottom: none;
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 280px;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: var(--brut-bg-2, #eef4f1);
    }

    canvas {
        display: block;
        width: 240px;
        max-width: 100%;
        height: auto;
    }

    .controls {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem 1rem;
        align-items: center;
    }

    .controls input {
        grid-column: 1 / -1;
        width: 100%;
        accent-color: var(--brut-accent, #247768);
    }

    button {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--brut-ink, #1a2421);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #1a2421);
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        cursor: pointer;
    }
</style>
