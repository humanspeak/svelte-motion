<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'

    const tabs = ['Home', 'React', 'Vue', 'Svelte']

    let selectedTab = $state(0)
</script>

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
                            class="selected-indicator"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    {/if}
                </AnimatePresence>
                <motion.button
                    role="tab"
                    aria-selected={isSelected}
                    onclick={() => (selectedTab = index)}
                    whileTap={{ scale: 0.9 }}
                    whileFocus={{
                        backgroundColor: 'var(--accent-transparent)'
                    }}
                >
                    {name}
                </motion.button>
            </li>
        {/each}
    </ul>
</nav>

<style>
    .container {
        width: fit-content;
        background-color: var(--color-card);
        border-radius: 10px;
        border: 1px solid var(--color-border);
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
        color: var(--color-foreground);
        position: relative;
    }

    :global(.selected-indicator) {
        background-color: #ff0088;
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        z-index: 1;
        border-radius: 5px;
    }

    .container :global(button) {
        all: unset;
        z-index: 2;
        position: relative;
        cursor: pointer;
        padding: 10px 14px;
        border-radius: 5px;
        color: var(--color-foreground);
        font-size: 14px;
        --accent-transparent: rgba(255, 0, 136, 0.15);
    }
</style>
