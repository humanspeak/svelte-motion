<script lang="ts">
    import { onMount } from 'svelte'
    import { animate, cancelFrame, frame } from '$lib'
    import { dialEffect, type Dial } from '../dialEffect'

    const dial: Dial = { angle: 0, radius: 40 }
    const plainBox = { x: 0 }

    let canvas = $state<HTMLCanvasElement | null>(null)
    let displayedAngle = $state(0)
    let displayedPlainX = $state(0)

    const draw = () => {
        if (!canvas) return

        const context = canvas.getContext('2d')
        if (!context) return

        const center = canvas.width / 2
        const endAngle = (dial.angle * Math.PI) / 180

        context.clearRect(0, 0, canvas.width, canvas.height)
        context.beginPath()
        context.arc(center, center, dial.radius, 0, Math.PI * 2)
        context.strokeStyle = '#374151'
        context.lineWidth = 16
        context.stroke()

        context.beginPath()
        context.arc(center, center, dial.radius, 0, endAngle)
        context.strokeStyle = '#60a5fa'
        context.lineCap = 'round'
        context.lineWidth = 16
        context.stroke()

        displayedAngle = Math.round(dial.angle)
        displayedPlainX = Math.round(plainBox.x)
    }

    const openDial = () => {
        animate(dial, { angle: 270, radius: 80 }, { type: 'spring', stiffness: 120, damping: 14 })
    }

    const resetDial = () => {
        animate(dial, { angle: 0, radius: 40 }, { duration: 0.3 })
    }

    const movePlainBox = () => {
        animate(plainBox, { x: 100 })
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

<div class="page">
    <h1>Custom effect — canvas dial</h1>
    <p>
        The same <code>animate()</code> API drives a plain object, while a custom effect writes its values
        before the canvas renders.
    </p>

    <div class="cards">
        <section class="card">
            <canvas bind:this={canvas} data-testid="dial-canvas" width="240" height="240"></canvas>
            <div class="controls">
                <button data-testid="open" onclick={openDial}>Open</button>
                <button data-testid="reset" onclick={resetDial}>Reset</button>
            </div>
            <div class="readout">
                angle: <output data-testid="angle">{displayedAngle}</output>°
            </div>
        </section>

        <section class="card">
            <h2>Plain-object fallback</h2>
            <p>An object that no registered effect claims still uses Motion's object animator.</p>
            <button data-testid="plain-open" onclick={movePlainBox}>Animate x</button>
            <div class="readout">
                x: <output data-testid="plain-x">{displayedPlainX}</output>
            </div>
        </section>
    </div>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    h1 {
        margin-bottom: 8px;
        font-size: 20px;
    }

    p {
        max-width: 560px;
        margin-bottom: 24px;
        color: #9ca3af;
    }

    .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        align-items: flex-start;
    }

    .card {
        padding: 20px;
        border: 1px solid #374151;
        border-radius: 16px;
        background: #171a21;
    }

    .card h2 {
        margin-bottom: 8px;
        font-size: 16px;
    }

    .card p {
        max-width: 280px;
        margin-bottom: 16px;
        font-size: 14px;
    }

    canvas {
        display: block;
    }

    .controls {
        display: flex;
        gap: 8px;
    }

    button {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: #374151;
        color: #e5e7eb;
        cursor: pointer;
    }

    .readout {
        margin-top: 16px;
        color: #6b7280;
        font-family: monospace;
    }
</style>
