<script lang="ts">
    import { mapValue, springValue, styleEffect, toMotionValue } from '@humanspeak/svelte-motion'

    // No motion components: a $state slider feeds the rune bridge, the
    // vanilla factories derive position, and styleEffect drives a plain div.
    let slider = $state(20)

    const progress = toMotionValue(() => slider / 100)
    const x = mapValue(progress, [0, 1], [0, 180])
    const smoothX = springValue(x, { stiffness: 300, damping: 22 })

    let box = $state<HTMLElement | null>(null)

    $effect(() => {
        if (!box) return
        const stop = styleEffect(box, { x: smoothX })
        return () => stop()
    })

    $effect(() => () => {
        progress.destroy()
        x.destroy()
        smoothX.destroy()
    })
</script>

<div class="flex flex-col items-center gap-4">
    <p class="text-text-muted text-sm">
        <code>$state</code> → <code>toMotionValue</code> → <code>mapValue</code> →
        <code>springValue</code> → <code>styleEffect</code>
    </p>
    <input type="range" min="0" max="100" bind:value={slider} class="w-56" aria-label="Drive x" />
    <div class="w-64 rounded-xl bg-neutral-800 p-1.5">
        <div bind:this={box} class="h-10 w-16 rounded-lg bg-violet-400"></div>
    </div>
</div>
