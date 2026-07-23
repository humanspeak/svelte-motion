<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    let bounds: HTMLElement | null = null
    let dragging = $state(false)

    // NOTE: `transformPerspective` (and the whileDrag `rotateX`/`rotateY`) are
    // motion transform channels that must compose with the live drag translation.
    // That composition only runs when `style` is an OBJECT — passing a stringified
    // style would drop the authored perspective. So this stays object-form.
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <section class="drag-strip" aria-label="Perspective drag example">
        <div class="strip-head">
            <span class="micro">// perspective drag</span>
            <span class="micro status">state: {dragging ? 'dragging' : 'idle'}</span>
        </div>

        <div class="stage-wrap">
            <div class="axis-label axis-label-top">transformPerspective 900</div>
            <div class="axis-label axis-label-bottom">rotateX −14° · rotateY 22°</div>

            <div bind:this={bounds} class="drag-stage">
                <motion.div
                    drag
                    dragConstraints={bounds}
                    dragElastic={0.28}
                    onDragStart={() => (dragging = true)}
                    onDragEnd={() => (dragging = false)}
                    whileHover={{ scale: 1.03 }}
                    whileDrag={{
                        rotateX: -14,
                        rotateY: 22,
                        scale: 1.08,
                        cursor: 'grabbing'
                    }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    aria-label="Draggable perspective card"
                    style={{
                        transformPerspective: 900,
                        width: 'clamp(104px, 17vw, 148px)',
                        aspectRatio: '1',
                        cursor: 'grab',
                        touchAction: 'none',
                        backgroundColor: 'var(--brut-accent, #247768)',
                        border: '1px solid var(--brut-ink, #0a0a0a)',
                        boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
                    }}
                >
                    <span class="tile-mark">SM</span>
                    <span class="tile-grip" aria-hidden="true">
                        <i></i><i></i><i></i><i></i>
                    </span>
                    <span class="tile-label">tilt</span>
                </motion.div>
            </div>
        </div>

        <div class="strip-foot">
            <div class="chips">
                <span class="chip">transformPerspective</span>
                <span class="chip">whileDrag rotateX</span>
                <span class="chip">whileDrag rotateY</span>
            </div>
            <span class="micro">elastic: 0.28</span>
        </div>
    </section>
</div>

<style>
    .dk-demo-shell {
        min-height: 560px;
        display: grid;
        place-items: center;
        padding: clamp(1rem, 4vw, 2.5rem);
    }

    .drag-strip {
        width: min(100%, 640px);
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

    .status {
        color: var(--brut-accent, #247768);
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
        flex-wrap: wrap;
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
    }

    .chip {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-2, #525252);
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        padding: 0.2rem 0.45rem;
    }

    .stage-wrap {
        position: relative;
        display: grid;
        place-items: center;
        min-height: clamp(320px, 58vw, 460px);
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background:
            linear-gradient(90deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            linear-gradient(0deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            var(--brut-bg-2, #eef4f1);
        background-size:
            28px 28px,
            28px 28px,
            auto;
    }

    .drag-stage {
        width: min(62vw, 380px);
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    .axis-label {
        position: absolute;
        font-family: var(--brut-mono, monospace);
        text-transform: uppercase;
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        color: var(--brut-ink-3, #9a9a9a);
        pointer-events: none;
    }

    .axis-label-top {
        top: 0.65rem;
    }

    .axis-label-bottom {
        bottom: 0.65rem;
    }

    :global(.drag-stage [aria-label='Draggable perspective card']) {
        position: relative;
        display: grid;
        grid-template-rows: auto 1fr auto;
        align-items: center;
        font-family: var(--brut-mono, monospace);
        text-transform: uppercase;
        font-size: 0.72rem;
        font-weight: 800;
        color: var(--brut-accent-ink, #f8fcfb);
        letter-spacing: 0.08em;
        user-select: none;
        overflow: hidden;
    }

    :global(.drag-stage [aria-label='Draggable perspective card']::before) {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid var(--brut-accent-ink, #f8fcfb);
        opacity: 0.32;
        pointer-events: none;
    }

    .tile-mark,
    .tile-label {
        position: relative;
        z-index: 1;
        padding-inline: 0.75rem;
    }

    .tile-mark {
        align-self: start;
        padding-top: 0.7rem;
        font-size: 0.66rem;
        opacity: 0.74;
    }

    .tile-label {
        align-self: end;
        padding-bottom: 0.72rem;
        justify-self: end;
    }

    .tile-grip {
        position: relative;
        z-index: 1;
        justify-self: center;
        display: grid;
        grid-template-columns: repeat(2, 5px);
        gap: 6px;
        opacity: 0.62;
    }

    .tile-grip i {
        width: 5px;
        aspect-ratio: 1;
        background: currentColor;
    }

    @media (max-width: 640px) {
        .stage-wrap {
            min-height: 360px;
        }

        .drag-stage {
            width: min(72vw, 320px);
        }
    }
</style>
