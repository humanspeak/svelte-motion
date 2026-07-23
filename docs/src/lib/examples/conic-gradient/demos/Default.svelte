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
    let width = $state(320)
    let height = $state(320)
    // Mirror the pivot into $state so the head readout stays live.
    let pivot = $state({ x: 50, y: 50 })

    const gradientX = useMotionValue(0.5)
    const gradientY = useMotionValue(0.5)

    const background = useTransform(
        () =>
            `conic-gradient(at ${gradientX.get() * 100}% ${gradientY.get() * 100}%, #0cdcf7, #ff0088, #fff312, #0cdcf7)`
    )

    function handlePointerMove(e: PointerEvent) {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const px = (e.clientX - rect.left) / rect.width
        const py = (e.clientY - rect.top) / rect.height
        gradientX.set(px)
        gradientY.set(py)
        pivot = { x: Math.round(px * 100), y: Math.round(py * 100) }
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
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// conic-gradient</span>
            <span class="micro readout">pivot {pivot.x}% {pivot.y}%</span>
        </div>

        <div class="stage">
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

        <div class="strip-foot">
            <span class="micro">useMotionValue → useTransform</span>
            <span class="micro">move cursor to steer</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 480px;
    }

    .strip {
        width: 100%;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
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
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .gradient-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 320px;
        height: 320px;
        cursor: crosshair;
        touch-action: none;
    }

    .gradient-wrapper :global(.gradient-box) {
        border: 1px solid var(--brut-ink, #0a0a0a);
    }
</style>
