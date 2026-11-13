<script lang="ts">
    import {
        animate,
        LazyMotion,
        motion,
        motionValue,
        pinchFeatures,
        type PinchProps
    } from '@humanspeak/svelte-motion'

    // Three cards limited to between 0.5x and 2x. Pinch each one past 2x:
    // - `elastic: 0` stops dead at the limit.
    // - the default (`elastic: 0.35`) lets the pinch go a little further,
    //   resisting, then springs back to the limit on release.
    // - `snapToOrigin` animates scale back to 1, and rotation and x/y to 0,
    //   whenever the pinch ends.

    const makeCard = (label: string, pinch: PinchProps) => ({
        label,
        pinch,
        scale: motionValue(1),
        rotate: motionValue(0),
        x: motionValue(0),
        y: motionValue(0)
    })

    const limits = { min: 0.5, max: 2 }
    const cards = [
        makeCard('elastic: 0', { scale: limits, elastic: 0 }),
        makeCard('default', { scale: limits }),
        makeCard('snapToOrigin', { scale: limits, snapToOrigin: true })
    ]

    const scales = $state(cards.map(() => 1))

    $effect(() => {
        const offs = cards.map((card, i) => card.scale.on('change', (v) => (scales[i] = v)))
        return () => offs.forEach((off) => off())
    })

    const reset = () => {
        for (const card of cards) {
            animate(card.scale, 1)
            animate(card.rotate, 0)
            animate(card.x, 0)
            animate(card.y, 0)
        }
    }
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// limits and elasticity</span>
            <span class="micro readout">scale 0.5 – 2</span>
        </div>

        <div class="frame">
            <LazyMotion features={pinchFeatures}>
                {#each cards as card, i (card.label)}
                    <div class="cell">
                        <motion.div
                            class="tile"
                            data-testid="pinch-limits-card"
                            pinch={card.pinch}
                            style={{
                                scale: card.scale,
                                rotate: card.rotate,
                                x: card.x,
                                y: card.y
                            }}
                        />
                        <span class="micro option">{card.label}</span>
                        <span class="micro readout">×{scales[i].toFixed(2)}</span>
                    </div>
                {/each}
            </LazyMotion>
        </div>

        <div class="strip-foot">
            <span class="micro hint">Pinch past 2x. Mouse: hold ctrl and scroll over a card.</span>
            <button type="button" class="reset" onclick={reset}>Reset</button>
        </div>
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
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .hint,
    .option {
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
        gap: 0.5rem;
        padding: 1rem 0.5rem;
        overflow: hidden;
        border: 1px solid var(--brut-rule, #d6dedb);
    }

    .cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
    }

    :global(.dk-demo-shell .tile) {
        width: 84px;
        height: 84px;
        border-radius: 14px;
        background: linear-gradient(135deg, #ff0088 0%, #8800ff 100%);
        margin-bottom: 0.5rem;
    }

    .reset {
        flex: none;
        padding: 0.35rem 0.8rem;
        border: 1px solid var(--brut-accent, #247768);
        background-color: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        text-transform: uppercase;
        cursor: pointer;
    }
</style>
