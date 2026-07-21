<script lang="ts">
    import { AnimatePresence, motion, styleString } from '@humanspeak/svelte-motion'

    // Classic tab pattern: only the active tab renders the indicator,
    // but the indicator shares a `layoutId` across all tabs so motion
    // animates it between positions on click. `AnimatePresence`
    // handles the mount/unmount handoff.

    const tabs = ['Home', 'React', 'Vue', 'Svelte']

    let selectedTab = $state(0)

    // .selected-indicator lived on a motion.div (styled via :global) —
    // moved inline so the motion element carries its own brut chrome.
    const indicatorStyle = styleString(() => ({
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        backgroundColor: 'var(--brut-accent, #247768)'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// tab-select</span>
            <span class="micro readout">tab: {tabs[selectedTab].toLowerCase()}</span>
        </div>

        <nav class="container">
            <ul role="tablist">
                {#each tabs as name, index (name)}
                    {@const isSelected = selectedTab === index}
                    <li class={isSelected ? 'selected' : ''}>
                        <AnimatePresence>
                            {#if isSelected}
                                <motion.div
                                    key="selected-indicator"
                                    layoutId="selected-indicator"
                                    style={indicatorStyle}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            {/if}
                        </AnimatePresence>
                        <motion.button
                            role="tab"
                            aria-selected={isSelected}
                            onclick={() => (selectedTab = index)}
                            animate={{
                                color: isSelected
                                    ? 'var(--brut-accent-ink, #f8fcfb)'
                                    : 'var(--brut-ink, #0a0a0a)'
                            }}
                            whileTap={{ scale: 0.9 }}
                            whileFocus={{
                                backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))'
                            }}
                        >
                            {name}
                        </motion.button>
                    </li>
                {/each}
            </ul>
        </nav>

        <div class="strip-foot">
            <span class="micro">layoutId: selected-indicator</span>
            <span class="micro">spring: 500 / 30</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 220px;
    }

    .strip {
        display: flex;
        flex-direction: column;
        align-items: stretch;
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
    }

    .container {
        width: 100%;
        background-color: var(--brut-bg, #f8fcfb);
        border: 1px solid var(--brut-ink, #0a0a0a);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        padding: 5px;
    }

    .container ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        gap: 5px;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }

    .container li {
        position: relative;
    }

    .container :global(button) {
        all: unset;
        z-index: 2;
        position: relative;
        cursor: pointer;
        padding: 10px 14px;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
</style>
