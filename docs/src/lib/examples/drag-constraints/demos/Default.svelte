<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    let bounds: HTMLElement | null = null
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <section class="constraint-lab" aria-label="Drag constraints example">
        <div class="lab-header">
            <span>drag lab</span>
            <strong>constraints ref</strong>
        </div>

        <div class="stage-wrap">
            <div class="axis-label axis-label-top">top</div>
            <div class="axis-label axis-label-right">right</div>
            <div class="axis-label axis-label-bottom">bottom</div>
            <div class="axis-label axis-label-left">left</div>

            <div bind:this={bounds} class="constraint-stage">
                <motion.div
                    drag
                    dragConstraints={bounds}
                    dragElastic={0.32}
                    whileHover={{ scale: 1.03 }}
                    whileDrag={{ scale: 1.08, cursor: 'grabbing' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    aria-label="Draggable constrained card"
                    style={styleString(() => ({
                        width: 'clamp(76px, 13vw, 112px)',
                        aspectRatio: '1',
                        borderRadius: '8px',
                        cursor: 'grab',
                        touchAction: 'none',
                        background: 'var(--drag-card-bg)',
                        border: 'var(--drag-card-border)',
                        boxShadow: 'var(--drag-card-shadow)'
                    }))}
                >
                    <span class="tile-mark">SM</span>
                    <span class="tile-grip" aria-hidden="true">
                        <i></i><i></i><i></i><i></i>
                    </span>
                    <span class="tile-label">drag</span>
                </motion.div>
            </div>
        </div>

        <div class="lab-footer">
            <span>elastic edge pull</span>
            <span>spring settle</span>
            <span>ref bounds</span>
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

    .constraint-lab {
        --lab-text: #f8fafc;
        --lab-bg:
            linear-gradient(135deg, rgb(2 6 23 / 0.94), rgb(15 23 42 / 0.9)),
            radial-gradient(
                circle at 18% 18%,
                color-mix(in oklab, var(--color-brand-400, #34d399) 28%, transparent),
                transparent 22rem
            );
        --lab-border: color-mix(in oklab, var(--color-brand-300, #6ee7b7) 34%, #334155);
        --lab-shadow: 0 24px 80px rgb(0 0 0 / 0.28);
        --lab-muted: rgb(226 232 240 / 0.68);
        --lab-accent: var(--color-brand-300, #6ee7b7);
        --lab-chip-bg: rgb(15 23 42 / 0.62);
        --lab-chip-border: rgb(148 163 184 / 0.28);
        --stage-border: rgb(148 163 184 / 0.2);
        --stage-grid: rgb(148 163 184 / 0.06);
        --constraint-border: rgb(226 232 240 / 0.32);
        --constraint-bg:
            linear-gradient(135deg, rgb(15 23 42 / 0.72), rgb(30 41 59 / 0.46)),
            radial-gradient(
                circle at center,
                color-mix(in oklab, var(--color-brand-400, #34d399) 16%, transparent),
                transparent 70%
            );
        --axis-label: rgb(226 232 240 / 0.42);
        --drag-card-text: #042f2e;
        --drag-card-frame: rgb(4 47 46 / 0.18);
        --drag-card-corner: rgb(4 47 46 / 0.14);
        --drag-card-bg:
            linear-gradient(135deg, rgb(255 255 255 / 0.16), transparent 38%),
            linear-gradient(135deg, var(--color-brand-300, #6ee7b7), #22d3ee 54%, #38bdf8);
        --drag-card-border: 1px solid
            color-mix(in oklab, var(--color-brand-100, #d1fae5) 76%, #ffffff 12%);
        --drag-card-shadow:
            0 18px 42px color-mix(in oklab, var(--color-brand-500, #10b981) 28%, transparent),
            0 1px 0 rgb(255 255 255 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.52),
            inset 0 -18px 28px rgb(2 6 23 / 0.12);
        width: min(100%, 760px);
        display: grid;
        gap: 1rem;
        padding: clamp(1rem, 3vw, 1.4rem);
        color: var(--lab-text);
        background: var(--lab-bg);
        border: 1px solid var(--lab-border);
        border-radius: 8px;
        box-shadow: var(--lab-shadow);
    }

    :global(html:not(.dark)) .constraint-lab {
        --lab-text: #0f172a;
        --lab-bg:
            linear-gradient(135deg, rgb(248 250 252 / 0.96), rgb(236 253 245 / 0.84)),
            radial-gradient(
                circle at 16% 16%,
                color-mix(in oklab, var(--color-brand-300, #6ee7b7) 36%, transparent),
                transparent 22rem
            );
        --lab-border: color-mix(in oklab, var(--color-brand-500, #10b981) 24%, #cbd5e1);
        --lab-shadow: 0 24px 70px rgb(15 23 42 / 0.12);
        --lab-muted: rgb(15 23 42 / 0.64);
        --lab-accent: var(--color-brand-700, #047857);
        --lab-chip-bg: rgb(255 255 255 / 0.74);
        --lab-chip-border: rgb(15 23 42 / 0.14);
        --stage-border: rgb(15 23 42 / 0.14);
        --stage-grid: rgb(15 23 42 / 0.07);
        --constraint-border: rgb(15 23 42 / 0.22);
        --constraint-bg:
            linear-gradient(135deg, rgb(255 255 255 / 0.86), rgb(240 253 250 / 0.7)),
            radial-gradient(
                circle at center,
                color-mix(in oklab, var(--color-brand-300, #6ee7b7) 22%, transparent),
                transparent 72%
            );
        --axis-label: rgb(15 23 42 / 0.42);
        --drag-card-text: #ecfeff;
        --drag-card-frame: rgb(236 253 245 / 0.28);
        --drag-card-corner: rgb(236 253 245 / 0.22);
        --drag-card-bg:
            linear-gradient(135deg, rgb(255 255 255 / 0.18), transparent 38%),
            linear-gradient(135deg, #0f766e, var(--color-brand-600, #059669) 52%, #0284c7);
        --drag-card-border: 1px solid rgb(15 118 110 / 0.42);
        --drag-card-shadow:
            0 18px 42px rgb(15 118 110 / 0.22), 0 1px 0 rgb(255 255 255 / 0.42),
            inset 0 1px 0 rgb(255 255 255 / 0.24), inset 0 -18px 28px rgb(2 6 23 / 0.22);
    }

    .lab-header,
    .lab-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-transform: uppercase;
        font-size: 0.72rem;
        color: var(--lab-muted);
    }

    .lab-header strong {
        color: var(--lab-accent);
        font-weight: 700;
    }

    .lab-footer {
        flex-wrap: wrap;
        justify-content: flex-start;
    }

    .lab-footer span {
        min-height: 1.5rem;
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--lab-chip-border);
        border-radius: 4px;
        padding: 0.18rem 0.45rem;
        background: var(--lab-chip-bg);
    }

    .stage-wrap {
        position: relative;
        display: grid;
        place-items: center;
        min-height: clamp(320px, 58vw, 480px);
        border: 1px dashed var(--stage-border);
        background-image:
            linear-gradient(var(--stage-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--stage-grid) 1px, transparent 1px);
        background-size: 28px 28px;
    }

    .constraint-stage {
        width: min(62vw, 380px);
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        border: 1px solid var(--constraint-border);
        border-radius: 8px;
        background: var(--constraint-bg);
    }

    .axis-label {
        position: absolute;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-transform: uppercase;
        font-size: 0.68rem;
        color: var(--axis-label);
        pointer-events: none;
    }

    .axis-label-top {
        top: 0.65rem;
    }

    .axis-label-right {
        right: 0.65rem;
        writing-mode: vertical-rl;
    }

    .axis-label-bottom {
        bottom: 0.65rem;
    }

    .axis-label-left {
        left: 0.65rem;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
    }

    :global(.constraint-stage [aria-label='Draggable constrained card']) {
        position: relative;
        display: grid;
        grid-template-rows: auto 1fr auto;
        align-items: center;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-transform: uppercase;
        font-size: 0.72rem;
        font-weight: 800;
        color: var(--drag-card-text);
        letter-spacing: 0.08em;
        user-select: none;
        overflow: hidden;
    }

    :global(.constraint-stage [aria-label='Draggable constrained card']::before) {
        content: '';
        position: absolute;
        inset: 9px;
        border: 1px solid var(--drag-card-frame);
        border-radius: 5px;
        pointer-events: none;
    }

    :global(.constraint-stage [aria-label='Draggable constrained card']::after) {
        content: '';
        position: absolute;
        right: -22px;
        bottom: -22px;
        width: 64px;
        aspect-ratio: 1;
        border: 1px solid var(--drag-card-corner);
        transform: rotate(45deg);
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
        opacity: 0.52;
    }

    .tile-grip i {
        width: 5px;
        aspect-ratio: 1;
        border-radius: 999px;
        background: currentColor;
    }

    @media (max-width: 640px) {
        .stage-wrap {
            min-height: 360px;
        }

        .constraint-stage {
            width: min(72vw, 320px);
        }
    }
</style>
