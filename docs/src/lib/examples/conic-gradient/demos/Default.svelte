<script lang="ts">
    import { writable } from 'svelte/store'
    import { motion, styleString, useTransform } from '@humanspeak/svelte-motion'

    // Pointer-tracking conic gradient. `useTransform` derives the
    // background string from two motion values; `styleString` glues
    // it onto the inline `style` attribute. Move the cursor across the
    // box and the gradient pivot follows.
    // Ported from the motion.dev conic-gradient example.

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

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div
        class="gradient-wrapper"
        bind:this={el}
        onpointermove={handlePointerMove}
        onpointerenter={handlePointerEnter}
        role="presentation"
    >
        <motion.div
            class="gradient-box"
            style={styleString(() => ({ background: $background, width, height }))}
        />
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 480px;
    }

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
