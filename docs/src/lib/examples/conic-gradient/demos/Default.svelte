<script lang="ts">
    import { motion, styleString, useMotionValue, useTransform } from '@humanspeak/svelte-motion'

    // Pointer-tracking conic gradient. Two motion values hold the pivot, and
    // `useTransform`'s compute form derives the background string from them —
    // the `.get()` reads are auto-tracked, so the value recomputes whenever a
    // pointer move updates them; `styleString` glues it onto the inline `style`
    // attribute. Move the cursor across the box and the gradient pivot follows.
    // Ported 1:1 from the motion.dev conic-gradient example (useMotionValue +
    // .get()).

    let el: HTMLElement | undefined = $state(undefined)
    let width = $state(400)
    let height = $state(400)

    const gradientX = useMotionValue(0.5)
    const gradientY = useMotionValue(0.5)

    const background = useTransform(
        () =>
            `conic-gradient(at ${gradientX.get() * 100}% ${gradientY.get() * 100}%, #0cdcf7, #ff0088, #fff312, #0cdcf7)`
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
