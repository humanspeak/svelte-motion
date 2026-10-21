<script lang="ts">
    import { animate, useScopeMotion } from '@humanspeak/svelte-motion'

    // Scatter runs inside the scope with run(), so its animations are
    // collected. Reset calls cancel(): every running animation stops and the
    // tiles' inline styles are restored to what they were before the scope
    // touched them, so they snap straight home.

    const tiles = Array.from({ length: 9 }, (_, index) => index + 1)
    const random = (range: number) => (Math.random() * 2 - 1) * range

    let root = $state<HTMLElement | null>(null)
    let label = $state('active')

    const scope = useScopeMotion(() => {}, {
        transition: { type: 'spring', visualDuration: 0.6, bounce: 0.3 }
    })

    const scatter = () => {
        const current = scope.current
        if (!current || !root) return
        // A cancelled scope collects again once it is refreshed.
        if (current.state !== 'active') current.refresh()
        const elements = root.querySelectorAll<HTMLElement>('.tile')
        current.run(() => {
            elements.forEach((element, index) => {
                animate(
                    element,
                    { x: random(90), y: random(60), rotate: random(45) },
                    { delay: index * 0.03 }
                )
            })
        })
        label = current.state
    }

    const reset = () => {
        scope.current?.cancel()
        label = scope.current?.state ?? 'detached'
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// cancel resets</span>
            <span class="micro readout">scope · {label}</span>
        </div>

        <div class="stage">
            <div class="grid" bind:this={root} {@attach scope}>
                {#each tiles as tile (tile)}
                    <div class="tile" class:accent={tile % 3 === 0}>
                        {String(tile).padStart(2, '0')}
                    </div>
                {/each}
            </div>
        </div>

        <div class="controls">
            <button type="button" onclick={scatter}>Scatter</button>
            <button type="button" onclick={reset}>Reset (cancel)</button>
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
        width: min(100%, 360px);
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .strip-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .readout {
        color: var(--brut-accent, #247768);
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 240px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(3, 56px);
        gap: 0.5rem;
    }

    .tile {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 56px;
        height: 56px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.875rem;
    }

    .tile.accent {
        background: var(--brut-accent, #247768);
        color: var(--brut-bg, #f8fcfb);
    }

    .controls {
        display: flex;
        gap: 0.5rem;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
    }

    button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
        color: var(--brut-bg, #f8fcfb);
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
    }
</style>
