<script lang="ts">
    import { mapValue, springValue, styleEffect, toMotionValue } from '@humanspeak/svelte-motion'

    // No motion components: a $state slider feeds the rune bridge, the
    // vanilla factories derive position AND color (mapValue mixes color
    // stops), and styleEffect drives a plain div.
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

<div class="flex flex-col items-center gap-4 pt-1 pb-5">
    <p class="text-text-muted text-sm">
        <code>$state</code> → <code>toMotionValue</code> → <code>mapValue</code> →
        <code>springValue</code> → <code>styleEffect</code>
    </p>
    <input
        type="range"
        min="0"
        max="100"
        bind:value={slider}
        class="w-56 accent-[#9911ff]"
        aria-label="Drive x"
    />
    <div
        class="w-64 rounded-2xl bg-black/5 p-2 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10"
    >
        <div bind:this={box} class="h-10 w-16 rounded-xl"></div>
    </div>
</div>
