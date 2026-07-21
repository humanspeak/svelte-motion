<script lang="ts">
    import { AnimatePresence, LayoutGroup, motion, styleString } from '@humanspeak/svelte-motion'

    // Two sibling tab strips share `layoutId="underline"`. Each is
    // wrapped in its own `<LayoutGroup id>` so the underline animation
    // stays scoped — clicking on the right strip doesn't pull the
    // underline from the left strip across the page. Remove the
    // LayoutGroups and the underline will jump between strips on click.

    let selectedA = $state(0)
    let selectedB = $state(0)

    const tabs = [0, 1, 2] as const

    const underlineStyle = styleString(() => ({
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'var(--brut-accent, #247768)'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="board">
        <article>
            <header>
                <span class="micro label">// group a</span>
                <span class="micro readout">tab {selectedA}</span>
            </header>
            <LayoutGroup id="strip-a">
                <div class="tab-strip">
                    {#each tabs as id (id)}
                        <button type="button" class="tab" onclick={() => (selectedA = id)}>
                            Tab {id}
                            <AnimatePresence>
                                {#if selectedA === id}
                                    <motion.div
                                        key="underline"
                                        layoutId="underline"
                                        style={underlineStyle}
                                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                                    ></motion.div>
                                {/if}
                            </AnimatePresence>
                        </button>
                    {/each}
                </div>
            </LayoutGroup>
        </article>

        <article>
            <header>
                <span class="micro label">// group b</span>
                <span class="micro readout">tab {selectedB}</span>
            </header>
            <LayoutGroup id="strip-b">
                <div class="tab-strip">
                    {#each tabs as id (id)}
                        <button type="button" class="tab" onclick={() => (selectedB = id)}>
                            Tab {id}
                            <AnimatePresence>
                                {#if selectedB === id}
                                    <motion.div
                                        key="underline"
                                        layoutId="underline"
                                        style={underlineStyle}
                                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                                    ></motion.div>
                                {/if}
                            </AnimatePresence>
                        </button>
                    {/each}
                </div>
            </LayoutGroup>
        </article>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 280px;
    }

    .board {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2.5rem;
        padding: 1.5rem;
        width: 100%;
        max-width: 720px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .label {
        font-weight: 700;
        color: var(--brut-ink-2, #525252);
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .tab-strip {
        display: flex;
        gap: 4px;
        justify-content: center;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding: 1rem;
    }

    .tab {
        position: relative;
        padding: 0.5rem 1.25rem;
        border: none;
        background: transparent;
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.8125rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        cursor: pointer;
    }
</style>
