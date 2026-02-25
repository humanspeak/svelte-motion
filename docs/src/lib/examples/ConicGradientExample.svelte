<!--
  @component
  Pointer-tracking conic gradient using useTransform (function form) and writable stores.
  Ported from the motion.dev conic-gradient example.
-->
<script lang="ts">
    import { writable } from 'svelte/store'
    import { motion, useTransform } from '@humanspeak/svelte-motion'

    let el: HTMLElement | undefined = $state(undefined)
    let width = $state(400)
    let height = $state(400)

    const gradientX = writable(0.5)
    const gradientY = writable(0.5)

    const background = useTransform(
        () =>
            `conic-gradient(at ${$gradientX * 100}% ${$gradientY * 100}%, #0cdcf7, #ff0088, #fff312, #0cdcf7)`,
        [gradientX, gradientY]
    )

    function handlePointerMove(e: PointerEvent) {
        if (!el) return
        const rect = el.getBoundingClientRect()
        gradientX.set((e.clientX - rect.left) / rect.width)
        gradientY.set((e.clientY - rect.top) / rect.height)
    }

    function handlePointerEnter() {
        if (!el) return
        const rect = el.getBoundingClientRect()
        width = rect.width
        height = rect.height
    }
</script>

<div
    class="gradient-wrapper"
    bind:this={el}
    onpointermove={handlePointerMove}
    onpointerenter={handlePointerEnter}
    role="presentation"
>
    <motion.div
        class="gradient-box"
        style="background: {$background}; width: {width}px; height: {height}px;"
    />
</div>

<style>
    .gradient-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 400px;
        height: 400px;
    }

    .gradient-wrapper :global(.gradient-box) {
        border-radius: 30px;
    }
</style>
