<script lang="ts">
    import { PanelLeft, Target } from '@lucide/svelte'
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'

    // #1935 (Motion 14.7.1): a centred tab bar whose Lettuce tab opens a
    // sidebar, so the whole bar jumps left in the same update as the
    // underline moves. With `layoutRoot` on the list, the underline animates
    // relative to the list: it glides exactly one tab. Without it, it flies
    // in from where the old tab used to be on the page.
    const tabs = ['🍅 Tomato', '🥬 Lettuce', '🧀 Cheese']

    let selected = $state(tabs[0])
    let layoutRoot = $state(true)

    const transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] } as const
    const showSidebar = $derived(selected === tabs[1])
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="layoutRoot controls">
        <button
            type="button"
            class:active={layoutRoot}
            aria-pressed={layoutRoot}
            onclick={() => {
                layoutRoot = !layoutRoot
                selected = tabs[0]
            }}
        >
            <Target size={15} />
            layoutRoot: {layoutRoot ? 'on' : 'off'}
        </button>
        <span class="hint"><PanelLeft size={15} /> Lettuce opens a sidebar</span>
    </div>

    <div class="window">
        <!-- layoutRoot is read when the list mounts, so remount it to toggle -->
        {#key layoutRoot}
            <motion.ul class="tabs" layout={layoutRoot} {layoutRoot}>
                {#each tabs as item (item)}
                    <li>
                        <button
                            type="button"
                            class="tab"
                            class:selected={item === selected}
                            onclick={() => (selected = item)}
                        >
                            {item}
                        </button>
                        <AnimatePresence>
                            {#if item === selected}
                                <motion.div
                                    key="underline"
                                    class="underline"
                                    layoutId="layout-root-underline"
                                    {transition}
                                />
                            {/if}
                        </AnimatePresence>
                    </li>
                {/each}
            </motion.ul>
        {/key}
        {#if showSidebar}
            <aside>Sidebar</aside>
        {/if}
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(320px, calc(100vh - 160px), 380px);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 16px;
        padding: 20px 26px;
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
    }

    .toolbar button {
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 12px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
    }

    .toolbar button.active {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .hint {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--brut-ink-2, #4a5552);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
    }

    .window {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 0;
        padding-top: 40px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    .window :global(.tabs) {
        display: flex;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        position: relative;
        width: 120px;
    }

    .tab {
        width: 100%;
        height: 48px;
        border: 0;
        background: transparent;
        color: var(--brut-ink-2, #4a5552);
        font-size: 15px;
        cursor: pointer;
    }

    .tab.selected {
        color: var(--brut-ink, #0a0a0a);
        font-weight: 700;
    }

    .window :global(.underline) {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 3px;
        background: var(--brut-accent, #247768);
    }

    aside {
        width: 220px;
        height: 160px;
        display: grid;
        place-items: center;
        border-left: 1px solid var(--brut-rule-2, #bbc4c0);
        color: var(--brut-ink-2, #4a5552);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
        text-transform: uppercase;
    }
</style>
