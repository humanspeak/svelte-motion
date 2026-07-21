<script lang="ts">
    import { mapValue, springValue, styleEffect, toMotionValue } from '@humanspeak/svelte-motion'

    // No motion components anywhere: a $state slider feeds the rune
    // bridge (toMotionValue), the vanilla factories derive position and
    // color, and styleEffect binds them to a plain div.
    let slider = $state(20)

    const progress = toMotionValue(() => slider / 100)
    const x = mapValue(progress, [0, 1], [0, 180])
    const smoothX = springValue(x, { stiffness: 300, damping: 22 })
    const smoothProgress = springValue(progress, { stiffness: 300, damping: 22 })
    const backgroundColor = mapValue(smoothProgress, [0, 0.5, 1], ['#ff0088', '#9911ff', '#00ccff'])
    const boxShadow = mapValue(
        smoothProgress,
        [0, 0.5, 1],
        [
            '0 6px 18px rgba(255, 0, 136, 0.45)',
            '0 6px 18px rgba(153, 17, 255, 0.45)',
            '0 6px 18px rgba(0, 204, 255, 0.45)'
        ]
    )

    let box = $state<HTMLElement | null>(null)

    $effect(() => {
        if (!box) return
        const stop = styleEffect(box, { x: smoothX, backgroundColor, boxShadow })
        return () => stop()
    })

    $effect(() => () => {
        progress.destroy()
        x.destroy()
        smoothX.destroy()
        smoothProgress.destroy()
        backgroundColor.destroy()
        boxShadow.destroy()
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// vanilla-values</span>
            <span class="micro readout">progress {slider}%</span>
        </div>

        <div class="stage">
            <div class="stack">
                <input
                    type="range"
                    min="0"
                    max="100"
                    bind:value={slider}
                    aria-label="Drive the values"
                />
                <div class="track">
                    <div bind:this={box} class="box"></div>
                </div>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">toMotionValue → mapValue → springValue → styleEffect</span>
            <span class="micro">no motion.* components</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 280px;
    }

    .strip {
        width: 100%;
        max-width: 420px;
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
        text-transform: none;
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

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.75rem 1rem;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: var(--brut-bg-2, #eef4f1);
    }

    .stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
    }

    input[type='range'] {
        width: 224px;
        accent-color: var(--brut-accent, #247768);
    }

    .track {
        width: 260px;
        padding: 8px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    .box {
        width: 64px;
        height: 40px;
    }
</style>
