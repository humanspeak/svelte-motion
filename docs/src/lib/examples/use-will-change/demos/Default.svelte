<script lang="ts">
    import { Sparkles } from '@lucide/svelte'
    import { motion, useWillChange } from '@humanspeak/svelte-motion'

    // Two independent will-change values: one attached to a transform animation,
    // one to a paint-only animation. The badge on each box shows its live value.
    const moveWillChange = useWillChange()
    const paintWillChange = useWillChange()

    let started = $state(false)
    let moved = $state(false)
    let recolored = $state(false)

    // No transform key until the first click, so will-change starts at "auto".
    const moveTarget = $derived(started ? { x: moved ? 150 : 0 } : {})

    const toggleMove = () => {
        started = true
        moved = !moved
    }
</script>

<div class="demo">
    <div class="row">
        <section class="cell">
            <header>
                <span class="tag promote">promotes</span>
                Animating <code>x</code> (transform)
            </header>
            <div class="lane">
                <motion.div
                    class="box move"
                    style={{ willChange: moveWillChange }}
                    initial={false}
                    animate={moveTarget}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <small>will-change</small>
                    <span class="val" class:on={moveWillChange.current === 'transform'}>
                        {moveWillChange.current}
                    </span>
                </motion.div>
            </div>
            <button type="button" onclick={toggleMove}>
                <Sparkles size={15} />
                {moved ? 'Return' : 'Animate x'}
            </button>
        </section>

        <section class="cell">
            <header>
                <span class="tag stay">stays auto</span>
                Animating <code>backgroundColor</code> (paint)
            </header>
            <div class="lane">
                <motion.div
                    class="box paint"
                    style={{ willChange: paintWillChange }}
                    initial={false}
                    animate={{ backgroundColor: recolored ? '#f0abfc' : '#67e8f9' }}
                    transition={{ duration: 0.6 }}
                >
                    <small>will-change</small>
                    <span class="val" class:on={paintWillChange.current === 'transform'}>
                        {paintWillChange.current}
                    </span>
                </motion.div>
            </div>
            <button type="button" onclick={() => (recolored = !recolored)}>
                <Sparkles size={15} />
                {recolored ? 'Reset' : 'Animate color'}
            </button>
        </section>
    </div>
</div>

<style>
    /* Theme-aware: light is the default; html.dark overrides below. Surfaces are
       built from the docs brand scale (--color-brand-50…900) so the stage adapts
       to the page theme instead of being a hardcoded dark slab. */
    .demo {
        display: grid;
        gap: 16px;
        padding: 22px 24px;
        background: var(--color-brand-50);
        color: color-mix(in oklab, var(--color-brand-900) 80%, transparent);
    }

    :global(html.dark) .demo {
        background: var(--color-brand-900);
        color: color-mix(in oklab, var(--color-brand-100) 80%, transparent);
    }

    .row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
    }

    .cell {
        display: grid;
        gap: 12px;
        align-content: start;
        padding: 16px;
        border: 1px solid color-mix(in oklab, var(--color-brand-500) 22%, transparent);
        border-radius: 10px;
        background: color-mix(in oklab, var(--color-brand-50) 55%, white);
    }

    :global(html.dark) .cell {
        border-color: color-mix(in oklab, var(--color-brand-500) 26%, transparent);
        background: color-mix(in oklab, var(--color-brand-800) 45%, var(--color-brand-900));
    }

    header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: color-mix(in oklab, var(--color-brand-900) 72%, transparent);
    }

    :global(html.dark) header {
        color: color-mix(in oklab, var(--color-brand-100) 72%, transparent);
    }

    header code {
        color: var(--color-brand-700);
        font-family: 'SFMono-Regular', Consolas, monospace;
    }

    :global(html.dark) header code {
        color: var(--color-brand-300);
    }

    .tag {
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .tag.promote {
        background: color-mix(in oklab, var(--color-brand-500) 20%, transparent);
        color: var(--color-brand-700);
    }

    .tag.stay {
        background: color-mix(in oklab, var(--color-brand-900) 9%, transparent);
        color: color-mix(in oklab, var(--color-brand-900) 60%, transparent);
    }

    :global(html.dark) .tag.promote {
        background: color-mix(in oklab, var(--color-brand-500) 26%, transparent);
        color: var(--color-brand-200);
    }

    :global(html.dark) .tag.stay {
        background: color-mix(in oklab, var(--color-brand-100) 12%, transparent);
        color: color-mix(in oklab, var(--color-brand-100) 62%, transparent);
    }

    /* Fixed-height lane in normal flow — can't collapse, and overflow clips the
       box as it slides so the translate stays self-contained. */
    .lane {
        position: relative;
        height: 124px;
        display: flex;
        align-items: center;
        padding: 0 16px;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, var(--color-brand-500) 16%, transparent);
        background: color-mix(in oklab, var(--color-brand-500) 9%, var(--color-brand-50));
    }

    :global(html.dark) .lane {
        border-color: color-mix(in oklab, var(--color-brand-500) 22%, transparent);
        background: color-mix(in oklab, var(--color-brand-500) 14%, var(--color-brand-900));
    }

    /* The boxes are vivid by design (they're the thing being animated), so their
       label ink is dark in both themes. */
    :global(.demo .box) {
        flex: none;
        width: 116px;
        height: 92px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 4px;
        border-radius: 14px;
        color: color-mix(in oklab, var(--color-brand-900) 90%, black);
        box-shadow: 0 14px 40px color-mix(in oklab, var(--color-brand-500) 32%, transparent);
    }

    :global(.demo .box.move) {
        background: linear-gradient(135deg, var(--color-brand-400), var(--color-brand-600));
    }

    :global(.demo .box.paint) {
        background: #67e8f9;
    }

    :global(.demo .box small) {
        font-size: 9px;
        font-weight: 850;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.72;
    }

    /* Self-contained chip colors. The boxes are a constant vivid teal/cyan in
       both themes, so fixed ink/light pairs keep contrast regardless of the
       page theme — and a <span> avoids docs-kit's global <strong> color rule. */
    :global(.demo .box .val) {
        padding: 2px 9px;
        border-radius: 999px;
        background: rgba(3, 19, 22, 0.82);
        color: #ecfeff;
        font-size: 15px;
        font-weight: 700;
        font-family: 'SFMono-Regular', Consolas, monospace;
    }

    :global(.demo .box .val.on) {
        background: #ecfeff;
        color: #0b3b33;
    }

    button {
        justify-self: start;
        height: 34px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 13px;
        border: 1px solid var(--color-brand-600);
        border-radius: 6px;
        background: var(--color-brand-600);
        color: var(--color-brand-50);
        font-size: 13px;
        font-weight: 780;
        cursor: pointer;
    }

    button:hover {
        background: var(--color-brand-700);
        border-color: var(--color-brand-700);
    }

    @media (max-width: 720px) {
        .row {
            grid-template-columns: 1fr;
        }
    }
</style>
