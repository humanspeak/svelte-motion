<script lang="ts">
    import {
        MotionConfig,
        motion,
        styleString,
        type MotionTransformPoint
    } from '@humanspeak/svelte-motion'

    let bounds = $state<HTMLElement | null>(null)
    let zoomX = $state(0.5)
    let zoomY = $state(0.5)
    let dragging = $state(false)

    const correctPoint: MotionTransformPoint = ({ x, y }) => ({
        x: x / zoomX,
        y: y / zoomY
    })

    const setZoom = (x: number, y = x) => {
        zoomX = x
        zoomY = y
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <section class="zoom-strip" aria-label="Scaled drag board example">
        <div class="strip-head">
            <span class="micro">// transform page point</span>
            <span class="micro status"
                >zoom: {Math.round(zoomX * 100)}% × {Math.round(zoomY * 100)}%</span
            >
        </div>

        <div class="zoom-controls" aria-label="Zoom presets">
            <button class:active={zoomX === 0.5 && zoomY === 0.5} onclick={() => setZoom(0.5)}
                >50%</button
            >
            <button class:active={zoomX === 1 && zoomY === 1} onclick={() => setZoom(1)}
                >100%</button
            >
            <button class:active={zoomX === 1.5 && zoomY === 1.5} onclick={() => setZoom(1.5)}
                >150%</button
            >
            <button class:active={zoomX === 0.6 && zoomY === 1.2} onclick={() => setZoom(0.6, 1.2)}
                >60 × 120</button
            >
        </div>

        <div class="viewport">
            <div class="scaled-board" style:transform={`scale(${zoomX}, ${zoomY})`}>
                <div class="board" bind:this={bounds}>
                    <MotionConfig transformPagePoint={correctPoint}>
                        <motion.div
                            drag
                            dragConstraints={bounds}
                            dragElastic={0}
                            dragMomentum={false}
                            onDragStart={() => (dragging = true)}
                            onDragEnd={() => (dragging = false)}
                            whileDrag={{ scale: 1.06, cursor: 'grabbing' }}
                            aria-label="Draggable zoom-corrected tile"
                            style={styleString(() => ({
                                width: '104px',
                                height: '104px',
                                touchAction: 'none',
                                cursor: 'grab',
                                backgroundColor: 'var(--brut-accent, #247768)',
                                border: '2px solid var(--brut-ink, #0a0a0a)',
                                boxShadow: '7px 7px 0 var(--brut-rule, #d6dedb)'
                            }))}
                        >
                            <span class="tile-mark">{dragging ? 'MOVE' : 'DRAG'}</span>
                            <span class="tile-scale">local units</span>
                        </motion.div>
                    </MotionConfig>
                </div>
            </div>
        </div>

        <div class="strip-foot">
            <span class="chip">pointer locked</span>
            <span class="chip">measured bounds</span>
            <span class="micro">drag momentum: off</span>
        </div>
    </section>
</div>

<style>
    .dk-demo-shell {
        min-height: 570px;
        display: grid;
        place-items: center;
        padding: clamp(1rem, 4vw, 2.5rem);
    }
    .zoom-strip {
        width: min(100%, 680px);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.6rem;
    }
    .strip-foot {
        border: 0;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding: 0.7rem 0 0;
        flex-wrap: wrap;
    }
    .micro,
    button,
    .chip {
        font-family: var(--brut-mono, monospace);
        font-size: 0.68rem;
        letter-spacing: 0.07em;
        text-transform: uppercase;
    }
    .micro {
        color: var(--brut-ink-3, #777);
    }
    .status {
        color: var(--brut-accent, #247768);
    }
    .zoom-controls {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
    }
    button,
    .chip {
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
        padding: 0.35rem 0.55rem;
    }
    button.active {
        background: var(--brut-ink, #0a0a0a);
        color: var(--brut-bg, #f8fcfb);
    }
    .viewport {
        height: 390px;
        overflow: auto;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: repeating-linear-gradient(
            135deg,
            transparent 0 14px,
            color-mix(in srgb, var(--brut-rule, #d6dedb) 35%, transparent) 14px 15px
        );
        padding: 42px;
    }
    .scaled-board {
        width: max-content;
        transform-origin: top left;
    }
    .board {
        width: 520px;
        height: 300px;
        display: grid;
        place-items: center;
        border: 2px dashed var(--brut-accent, #247768);
        background: var(--brut-bg-2, #eef4f1);
    }
    :global(.board [aria-label='Draggable zoom-corrected tile']) {
        display: grid;
        place-items: center;
        align-content: center;
        gap: 0.35rem;
        color: white;
        font-family: var(--brut-mono, monospace);
        font-weight: 800;
        user-select: none;
    }
    .tile-mark {
        font-size: 1rem;
        letter-spacing: 0.08em;
    }
    .tile-scale {
        font-size: 0.58rem;
        text-transform: uppercase;
        opacity: 0.8;
    }
</style>
