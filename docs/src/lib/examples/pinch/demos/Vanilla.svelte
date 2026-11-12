<script lang="ts">
    import { pinch } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    // A plain <div> made pinchable with the vanilla pinch(), no motion
    // component and no LazyMotion. The start callback returns handlers for
    // that one gesture. Rotation snaps to the nearest 45deg on release.
    // onMount returns pinch()'s stop function, so the gesture is removed
    // when the component unmounts.

    let card: HTMLDivElement
    let live = $state('')
    let log = $state<{ id: number; line: string }[]>([])
    let nextId = 0

    const write = (line: string) => {
        log = [{ id: nextId++, line }, ...log].slice(0, 5)
    }

    onMount(() => {
        return pinch(
            card,
            () => {
                write('start')
                return {
                    onPinch: (_, info) => {
                        live = `×${info.scale.toFixed(2)} · ${Math.round(info.rotate)}°`
                    },
                    onComplete: (_, info) => {
                        live = ''
                        write(`end ×${info.scale.toFixed(2)} · ${Math.round(info.rotate)}°`)
                    }
                }
            },
            { rotate: { snap: 45 } }
        )
    })
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// vanilla pinch()</span>
            <span class="micro readout">{live || 'idle'}</span>
        </div>

        <div class="frame">
            <div class="card" bind:this={card} data-testid="pinch-vanilla-card"></div>
            <ol class="log" aria-live="polite">
                {#each log as entry (entry.id)}
                    <li class="micro">{entry.line}</li>
                {:else}
                    <li class="micro">no pinches yet</li>
                {/each}
            </ol>
        </div>

        <div class="strip-foot">
            <span class="micro"
                >pinch(card, onPinchStart, &#123; rotate: &#123; snap: 45 &#125; &#125;)</span
            >
        </div>
        <span class="micro hint">Mouse: hold ctrl and scroll over the card.</span>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem 0.75rem;
        min-height: 360px;
    }

    .strip {
        width: 100%;
        max-width: 36rem;
        min-width: 0;
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
        overflow-wrap: anywhere;
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .hint {
        text-transform: none;
        letter-spacing: 0.02em;
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

    .frame {
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: space-around;
        flex-wrap: wrap;
        gap: 1.5rem;
        padding: 1.5rem 1rem;
        overflow: hidden;
        border: 1px solid var(--brut-rule, #d6dedb);
    }

    .card {
        width: 140px;
        height: 140px;
        border-radius: 18px;
        background: linear-gradient(135deg, #0cdcf7 0%, #247768 100%);
    }

    .log {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 10rem;
        font-variant-numeric: tabular-nums;
    }
</style>
