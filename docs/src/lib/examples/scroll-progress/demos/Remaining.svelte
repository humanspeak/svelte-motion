<script lang="ts">
    import { useScroll } from '@humanspeak/svelte-motion'

    // Distance-to-the-end readout fed by `useScroll`'s `scrollYLength` (the
    // container's maximum scroll offset). `scrollYLength - scrollY` is how far
    // is left to scroll. It updates when the container resizes, and on the next scroll.
    let containerEl: HTMLElement | undefined = $state(undefined)

    // Pass a getter so useScroll resolves the element after mount.
    const { scrollY, scrollYLength } = useScroll({ container: () => containerEl })

    const remaining = $derived(Math.max(0, Math.round(scrollYLength.current - scrollY.current)))
    // Fraction of the scroll still ahead, for the bar width.
    const remainingFraction = $derived(
        scrollYLength.current > 0 ? remaining / scrollYLength.current : 0
    )

    const rows = ['intro', 'setup', 'usage', 'options', 'returns', 'notes', 'faq', 'end']
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// distance-to-end</span>
            <span class="micro readout">{remaining} px left</span>
        </div>

        <div class="wrapper">
            <div class="remaining-track">
                <div class="remaining-bar" style="width: {remainingFraction * 100}%;"></div>
            </div>

            <div class="scroll-area" bind:this={containerEl}>
                {#each rows as row, i (row)}
                    <div class="row">
                        <span class="row-index">{String(i + 1).padStart(2, '0')}</span>
                        <span class="row-label">{row}</span>
                    </div>
                {/each}
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">scrollYLength − scrollY</span>
            <span class="micro">max {Math.round(scrollYLength.current)} px</span>
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

    .remaining-track {
        flex-shrink: 0;
        height: 6px;
        background: var(--brut-rule, #d6dedb);
    }

    .remaining-bar {
        height: 100%;
        background: var(--brut-accent, #247768);
    }

    .scroll-area {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
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

    .row {
        flex-shrink: 0;
        height: 72px;
        display: flex;
        align-items: center;
        gap: 1rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        padding: 0 0.875rem;
    }

    .row-index {
        font-family: var(--brut-mono, monospace);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .row-label {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--brut-ink-2, #525252);
    }
</style>
