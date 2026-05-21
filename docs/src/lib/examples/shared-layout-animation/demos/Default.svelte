<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'

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
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="wrapper">
        <nav>
            <ul role="tablist">
                {#each allIngredients as ingredient, i (ingredient.label)}
                    <motion.li
                        animate={{
                            backgroundColor:
                                i === selectedTab
                                    ? 'color-mix(in srgb, var(--color-card-foreground) 10%, transparent)'
                                    : 'transparent'
                        }}
                        class="tab"
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
                                    class="underline"
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
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 380px;
    }

    .wrapper {
        width: 320px;
        background: var(--color-card);
        color: var(--color-card-foreground);
        border-radius: 16px;
        overflow: hidden;
        box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.12),
            0 1px 2px rgba(0, 0, 0, 0.08);
    }

    nav {
        padding: 6px 6px 0;
        border-bottom: 1px solid var(--color-border);
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        gap: 2px;
    }

    :global(.tab) {
        position: relative;
        flex: 1;
        border-radius: 8px 8px 0 0;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .tab-button {
        all: unset;
        width: 100%;
        text-align: center;
        padding: 10px 0;
        font-size: 14px;
        cursor: pointer;
        user-select: none;
        color: var(--color-text-primary);
    }

    :global(.underline) {
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: royalblue;
        border-radius: 1px;
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
