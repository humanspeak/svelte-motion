<script lang="ts">
    import { animateLayout } from '@humanspeak/svelte-motion'

    // Shared-element handoff on plain elements: only the selected tab
    // renders the highlight and the underline. Selecting another tab
    // removes them from one tab and mounts new ones in another; elements
    // that share a data-layout-id animate from the old element's box.
    // .shared() gives the underline its own springier transition.

    const tabs = ['Overview', 'API', 'Examples', 'FAQ'] as const
    type Tab = (typeof tabs)[number]

    let selected = $state<Tab>('Overview')
    let root = $state<HTMLElement | null>(null)

    const select = (tab: Tab) => {
        if (!root || tab === selected) return
        animateLayout(
            root,
            () => {
                selected = tab
            },
            { duration: 0.25, ease: 'easeOut' }
        ).shared('tab-underline', { type: 'spring', visualDuration: 0.45, bounce: 0.35 })
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip" bind:this={root}>
        <div class="strip-head">
            <span class="micro">// shared underline</span>
            <span class="micro readout">tab · {selected.toLowerCase()}</span>
        </div>

        <div class="stage">
            <div class="tabs" role="tablist">
                {#each tabs as tab (tab)}
                    <button
                        type="button"
                        role="tab"
                        class="tab"
                        class:selected={selected === tab}
                        aria-selected={selected === tab}
                        onclick={() => select(tab)}
                    >
                        {#if selected === tab}
                            <span class="highlight" data-layout-id="tab-highlight"></span>
                            <span class="underline" data-layout-id="tab-underline"></span>
                        {/if}
                        <span class="label">{tab}</span>
                    </button>
                {/each}
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">attr: data-layout-id</span>
            <span class="micro">.shared('tab-underline')</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 400px;
    }

    .strip {
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

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
    }

    .tabs {
        display: flex;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
    }

    /* Labels differ in length, so the handoff animates size as well as
       position. */
    .tab {
        position: relative;
        padding: 0.875rem 1.125rem;
        border: none;
        background: none;
        color: var(--brut-ink-2, #525252);
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
    }

    .tab.selected {
        color: var(--brut-ink, #0a0a0a);
    }

    .label {
        position: relative;
    }

    /* Square corners: scaling a plain element stretches any border
       radius, and a hard 0 has nothing to distort. */
    .highlight {
        position: absolute;
        inset: 0;
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
    }

    .underline {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 3px;
        background: var(--brut-accent, #247768);
    }
</style>
