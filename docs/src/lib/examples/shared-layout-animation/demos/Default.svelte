<script lang="ts">
    import { AnimatePresence, motion, styleString } from '@humanspeak/svelte-motion'

    // Shared-layout: the underline carries a `layoutId="underline"` — when
    // it disappears under tab A and reappears under tab B, motion treats it
    // as the same element and tweens its rect between positions. The
    // content area uses `mode="wait"` so the outgoing emoji finishes its
    // exit before the next one enters.
    const allIngredients = [
        { icon: '🍅', label: 'Tomato' },
        { icon: '🥬', label: 'Lettuce' },
        { icon: '🧀', label: 'Cheese' }
    ]

    let selectedTab = $state(0)

    // .tab / .underline lived on motion elements (styled via :global) —
    // moved inline so each motion element carries its own brut chrome.
    const tabStyle = styleString(() => ({
        position: 'relative',
        flex: 1,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    }))

    const underlineStyle = styleString(() => ({
        position: 'absolute',
        bottom: '-1px',
        left: 0,
        right: 0,
        height: '3px',
        backgroundColor: 'var(--brut-accent, #247768)'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// shared-layout</span>
            <span class="micro readout">tab: {allIngredients[selectedTab].label.toLowerCase()}</span
            >
        </div>

        <div class="wrapper">
            <nav>
                <ul role="tablist">
                    {#each allIngredients as ingredient, i (ingredient.label)}
                        <motion.li
                            animate={{
                                backgroundColor:
                                    i === selectedTab
                                        ? 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))'
                                        : 'transparent'
                            }}
                            style={tabStyle}
                            role="presentation"
                        >
                            <button
                                class="tab-button"
                                type="button"
                                role="tab"
                                aria-selected={i === selectedTab}
                                onclick={() => (selectedTab = i)}
                            >
                                {ingredient.icon}
                                {ingredient.label}
                            </button>
                            <AnimatePresence>
                                {#if i === selectedTab}
                                    <motion.div
                                        key="underline"
                                        layoutId="underline"
                                        style={underlineStyle}
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                {/if}
                            </AnimatePresence>
                        </motion.li>
                    {/each}
                </ul>
            </nav>

            <div class="content-area">
                <AnimatePresence mode="wait">
                    {#key selectedTab}
                        <motion.div
                            key="content-{selectedTab}"
                            class="content"
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <span class="emoji">{allIngredients[selectedTab].icon}</span>
                        </motion.div>
                    {/key}
                </AnimatePresence>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">layoutId: underline</span>
            <span class="micro">mode: wait</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 380px;
    }

    .strip {
        width: 320px;
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
    }

    .wrapper {
        width: 100%;
        overflow: hidden;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    nav {
        padding: 6px 6px 0;
        border-bottom: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        gap: 2px;
    }

    /* Plain HTML child of the motion.li DO receive scoped styles. */
    .tab-button {
        all: unset;
        width: 100%;
        text-align: center;
        padding: 10px 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
        user-select: none;
        color: var(--brut-ink, #0a0a0a);
    }

    .content-area {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
    }

    :global(.content) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .emoji {
        font-size: 80px;
        line-height: 1;
    }
</style>
