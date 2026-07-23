<script lang="ts">
    import { motion, styleString, useScroll, useSpring } from '@humanspeak/svelte-motion'

    // Scroll-driven progress bar fed by `useScroll` and softened by `useSpring`.
    // The bar's `transform: scaleX(progress)` reads a 0→1 motion value computed
    // from the container's scroll position, so the bar grows as you scroll.
    let containerEl: HTMLElement | undefined = $state(undefined)

    // Pass a getter so useScroll resolves the element after mount.
    const { scrollYProgress } = useScroll({ container: () => containerEl })
    const scaleX = useSpring(scrollYProgress)

    // Brut panels replace the old rainbow cards — mono numbering, no palette.
    const cards = ['ingest', 'normalize', 'index', 'rank', 'serve']

    // Live readout of the smoothed scroll fraction, clamped for display.
    const pct = $derived(Math.round(Math.min(1, Math.max(0, scaleX.current)) * 100))

    // .card lived on a motion.div (styled via :global) — moved inline so the
    // motion element carries its own brut panel chrome.
    const cardStyle = styleString(() => ({
        flexShrink: 0,
        height: '150px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        background: 'var(--brut-bg-2, #eef4f1)',
        padding: '0.875rem',
        boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
        minWidth: 0
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// scroll-progress</span>
            <span class="micro readout">scroll {String(pct).padStart(3, ' ')}%</span>
        </div>

        <div class="wrapper">
            <div class="progress-bar" style="transform: scaleX({scaleX.current});"></div>

            <div class="scroll-area" bind:this={containerEl}>
                {#each cards as card, i (card)}
                    <motion.div
                        style={cardStyle}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <span class="card-index">{String(i + 1).padStart(2, '0')}</span>
                        <span class="card-label">{card}</span>
                    </motion.div>
                {/each}
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">useScroll → useSpring</span>
            <span class="micro">transform: scaleX</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 400px;
    }

    .strip {
        width: 100%;
        max-width: 400px;
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

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        white-space: pre;
    }

    .wrapper {
        width: 100%;
        height: 320px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .progress-bar {
        flex-shrink: 0;
        height: 6px;
        background: var(--brut-accent, #247768);
        transform-origin: left;
        z-index: 10;
    }

    .scroll-area {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .scroll-area::-webkit-scrollbar {
        width: 4px;
    }

    .scroll-area::-webkit-scrollbar-track {
        background: transparent;
    }

    .scroll-area::-webkit-scrollbar-thumb {
        background: var(--brut-rule-2, #bbc4c0);
    }

    /* Plain HTML children of the motion.div DO receive scoped styles. */
    .card-index {
        font-family: var(--brut-mono, monospace);
        font-size: 1.75rem;
        font-weight: 700;
        line-height: 1;
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .card-label {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--brut-ink-2, #525252);
    }
</style>
