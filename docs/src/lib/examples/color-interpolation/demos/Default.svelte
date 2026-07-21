<script lang="ts">
    import { animate } from 'motion'

    // Side-by-side comparison of how the browser's Web Animations API
    // and motion's `animate()` interpolate between two colors. WAAPI
    // interpolates in HSL (the path sweeps through hue), motion
    // interpolates in RGB (a straight line through colour space).

    let waapiElement: HTMLDivElement | undefined = $state(undefined)
    let motionElement: HTMLDivElement | undefined = $state(undefined)

    $effect(() => {
        if (!waapiElement || !motionElement) return

        // Web Animations API — HSL interpolation
        const waapiAnimation = waapiElement.animate(
            [{ backgroundColor: '#ff0088' }, { backgroundColor: '#0d63f8' }],
            {
                duration: 2000,
                iterations: Infinity,
                direction: 'alternate',
                easing: 'linear'
            }
        )

        // motion — RGB interpolation
        const motionAnimation = animate(
            motionElement,
            { backgroundColor: ['#ff0088', '#0d63f8'] },
            {
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'linear'
            }
        )

        return () => {
            waapiAnimation.cancel()
            motionAnimation.cancel()
        }
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// color-interpolation</span>
            <span class="micro readout">#ff0088 → #0d63f8</span>
        </div>

        <div class="stage">
            <div class="cell">
                <span class="micro">// browser hsl</span>
                <div class="swatch waapi" bind:this={waapiElement}></div>
            </div>
            <div class="cell">
                <span class="micro">// motion rgb</span>
                <div class="swatch motion" bind:this={motionElement}></div>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">hsl sweeps hue · rgb walks straight</span>
            <span class="micro">loop: 2s alternate</span>
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
        gap: 2.5rem;
        align-items: center;
        justify-content: center;
        padding: 1.75rem 0;
    }

    .cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    .swatch {
        width: 100px;
        height: 100px;
        background-color: #ff0088;
        border: 1px solid var(--brut-ink, #0a0a0a);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }
</style>
