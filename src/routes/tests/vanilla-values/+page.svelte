<script lang="ts">
    import {
        mapValue,
        motionValue,
        springValue,
        styleEffect,
        toMotionValue,
        transformValue
    } from '$lib'

    // The entire page runs on the VANILLA layer: no motion.* components —
    // plain DOM elements driven by styleEffect + value factories, with a
    // Svelte $state slider as the only input.

    let slider = $state(0)

    // Rune → MotionValue bridge (the getter is $state-tracked).
    const progress = toMotionValue(() => slider / 100)

    // Vanilla factories composing off the bridge.
    const x = mapValue(progress, [0, 1], [0, 240])
    const smoothX = springValue(x, { stiffness: 300, damping: 25 })
    const hue = mapValue(progress, [0, 1], [340, 200])
    const background = transformValue(() => `hsl(${Math.round(hue.get())}, 80%, 62%)`)

    // A raw counter value set imperatively from an event handler —
    // impossible with useMotionValue (component-init only).
    const clicks = motionValue(0)

    let directBox = $state<HTMLElement | null>(null)
    let springBox = $state<HTMLElement | null>(null)

    // styleEffect binds values straight to plain elements. Registered in
    // $effect so unbinding + value teardown follow the page lifecycle.
    $effect(() => {
        if (!(directBox && springBox)) return
        const stopDirect = styleEffect(directBox, { x, backgroundColor: background })
        const stopSpring = styleEffect(springBox, { x: smoothX, backgroundColor: background })
        return () => {
            stopDirect()
            stopSpring()
        }
    })

    $effect(() => () => {
        progress.destroy()
        x.destroy()
        smoothX.destroy()
        hue.destroy()
        background.destroy()
        clicks.destroy()
    })
</script>

<div class="page">
    <h1>Vanilla motion values — no motion components</h1>
    <p>
        A <code>$state</code> slider feeds <code>toMotionValue</code>; <code>mapValue</code>,
        <code>springValue</code> and <code>transformValue</code> derive position and color;
        <code>styleEffect</code> drives plain <code>&lt;div&gt;</code>s.
    </p>

    <label>
        Slider
        <input
            type="range"
            min="0"
            max="100"
            bind:value={slider}
            data-testid="slider"
            aria-label="Drive the motion values"
        />
    </label>

    <div class="track">
        <div class="box" bind:this={directBox} data-testid="direct-box">direct</div>
    </div>
    <div class="track">
        <div class="box" bind:this={springBox} data-testid="spring-box">spring</div>
    </div>

    <button data-testid="click-counter" onclick={() => clicks.set(clicks.get() + 1)}>
        clicked {clicks.current} times
    </button>

    <div class="readout" data-testid="readout">
        progress:{progress.current.toFixed(2)} x:{Math.round(x.current)} spring:{Math.round(
            smoothX.current
        )}
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
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        max-width: 520px;
        margin-bottom: 24px;
        color: #9ca3af;
    }

    label {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
    }

    input[type='range'] {
        width: 260px;
    }

    .track {
        width: 320px;
        margin-bottom: 12px;
        padding: 6px;
        border-radius: 12px;
        background: #1f2937;
    }

    .box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 72px;
        height: 44px;
        border-radius: 8px;
        color: #0f1115;
        font-size: 12px;
        font-weight: 600;
    }

    button {
        margin-top: 8px;
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: #374151;
        color: #e5e7eb;
        cursor: pointer;
    }

    .readout {
        margin-top: 16px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
