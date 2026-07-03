<script lang="ts">
    import { mapValue, springValue, styleEffect, toMotionValue } from '@humanspeak/svelte-motion'

    // No motion components anywhere: a $state slider feeds the rune
    // bridge (toMotionValue), the vanilla factories derive position and
    // color, and styleEffect binds them to a plain div.
    let slider = $state(20)

    const progress = toMotionValue(() => slider / 100)
    const x = mapValue(progress, [0, 1], [0, 180])
    const smoothX = springValue(x, { stiffness: 300, damping: 22 })
    const smoothProgress = springValue(progress, { stiffness: 300, damping: 22 })
    const backgroundColor = mapValue(smoothProgress, [0, 0.5, 1], ['#ff0088', '#9911ff', '#00ccff'])
    const boxShadow = mapValue(
        smoothProgress,
        [0, 0.5, 1],
        [
            '0 6px 18px rgba(255, 0, 136, 0.45)',
            '0 6px 18px rgba(153, 17, 255, 0.45)',
            '0 6px 18px rgba(0, 204, 255, 0.45)'
        ]
    )

    let box = $state<HTMLElement | null>(null)

    $effect(() => {
        if (!box) return
        const stop = styleEffect(box, { x: smoothX, backgroundColor, boxShadow })
        return () => stop()
    })

    $effect(() => () => {
        progress.destroy()
        x.destroy()
        smoothX.destroy()
        smoothProgress.destroy()
        backgroundColor.destroy()
        boxShadow.destroy()
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="stack">
        <input type="range" min="0" max="100" bind:value={slider} aria-label="Drive the values" />
        <div class="track">
            <div bind:this={box} class="box"></div>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 280px;
    }

    .stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
    }

    input[type='range'] {
        width: 224px;
        accent-color: #9911ff;
    }

    .track {
        width: 260px;
        padding: 8px;
        border-radius: 16px;
        background: rgba(120, 120, 140, 0.12);
    }

    .box {
        width: 64px;
        height: 40px;
        border-radius: 12px;
    }
</style>
