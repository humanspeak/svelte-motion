<script lang="ts">
    import { drag, motionValue } from '@humanspeak/svelte-motion'

    // A rotary dial on a plain <div>. drag() gets an `x` motion value
    // (Motion 14.10), so it writes the horizontal drag into that value instead
    // of moving the dial. The dial stays put and turns: 1px of drag is 1deg.
    // No motion component.

    let dial = $state<HTMLElement | null>(null)
    const x = motionValue(0)
    let degrees = $state(0)

    $effect(() => {
        if (!dial) return
        const el = dial
        const unsubscribe = x.on('change', (v) => {
            el.style.rotate = `${v}deg`
            degrees = Math.round(v)
        })
        const stop = drag(el, { axis: 'x', x })
        return () => {
            unsubscribe()
            stop()
        }
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// rotary dial</span>
            <span class="micro readout">rotate · {degrees}°</span>
        </div>

        <div class="stage">
            <div class="dial" bind:this={dial} aria-hidden="true">
                <span class="needle"></span>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">drag(dial, &#123; axis: 'x', x &#125;)</span>
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

    .dial {
        position: relative;
        box-sizing: border-box;
        width: 140px;
        height: 140px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        border-radius: 50%;
        background: var(--brut-bg, #f8fcfb);
        cursor: ew-resize;
    }

    .needle {
        position: absolute;
        top: 10px;
        left: calc(50% - 3px);
        width: 6px;
        height: 50px;
        background: var(--brut-accent, #247768);
        pointer-events: none;
    }
</style>
