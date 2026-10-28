<script lang="ts">
    import { createScopedAnimate } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    let cardA: HTMLElement | undefined = $state()
    let animateA: ReturnType<typeof createScopedAnimate> | undefined
    let shuffles = $state(0)

    onMount(() => {
        // Selectors passed to animateA only resolve inside card A.
        const scope = { current: cardA, animations: [] as { stop: () => void }[] }
        animateA = createScopedAnimate({ scope })
        // The scope only collects animations; stop them when the demo unmounts.
        return () => {
            for (const animation of scope.animations) animation.stop()
            scope.animations.length = 0
        }
    })

    const shuffle = () => {
        shuffles++
        const chips = cardA?.querySelectorAll('.chip').length ?? 0
        for (let i = 0; i < chips; i++) {
            animateA?.(
                `.chip:nth-child(${i + 1})`,
                { x: Math.round(Math.random() * 120), rotate: Math.round(Math.random() * 30 - 15) },
                { type: 'spring', bounce: 0.35, duration: 0.6 }
            )
        }
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <header>
            <span class="micro">// createScopedAnimate</span>
            <span class="micro readout">shuffles {shuffles}</span>
        </header>

        <div class="cards">
            <div class="card" bind:this={cardA}>
                <span class="micro">scoped</span>
                <div class="chips">
                    {#each ['A', 'B', 'C'] as label (label)}
                        <span class="chip">{label}</span>
                    {/each}
                </div>
            </div>
            <div class="card">
                <span class="micro">outside</span>
                <div class="chips">
                    {#each ['A', 'B', 'C'] as label (label)}
                        <span class="chip">{label}</span>
                    {/each}
                </div>
            </div>
        </div>

        <footer>
            <button type="button" onclick={shuffle}>shuffle '.chip'</button>
            <span class="micro">only the scoped card moves</span>
        </footer>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 310px;
        padding: 1.5rem;
    }

    .strip {
        display: flex;
        width: 100%;
        max-width: 390px;
        flex-direction: column;
        gap: 0.75rem;
    }

    header,
    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    header {
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    footer {
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.5rem;
    }

    .micro {
        color: var(--brut-ink-3, #6f7975);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
    }

    .cards {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    .chips {
        display: flex;
        gap: 0.5rem;
    }

    .chip {
        display: inline-flex;
        width: 2.25rem;
        height: 2.25rem;
        align-items: center;
        justify-content: center;
        background: var(--brut-accent, #247768);
        color: #fff;
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
    }

    button {
        border: 1px solid var(--brut-ink-3, #6f7975);
        background: transparent;
        color: inherit;
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        padding: 0.35rem 0.65rem;
        cursor: pointer;
    }
</style>
