<script lang="ts">
    import {
        animate,
        domMax,
        LazyMotion,
        motion,
        motionValue,
        pinchFeatures,
        type PinchInfo
    } from '@humanspeak/svelte-motion'

    // A port of Motion's `Pinch-photo` demo. Pinch (two touches, or a
    // trackpad pinch) to zoom and twist the card, and drag to move it. Past
    // its limits it resists, and springs back on release. Rotation snaps to
    // the nearest 90deg. `pinch` needs `pinchFeatures`, loaded here next to
    // `domMax` for `drag`.

    // The card's transform, as motion values, so Reset can animate it home.
    const scale = motionValue(1)
    const rotate = motionValue(0)
    const x = motionValue(0)
    const y = motionValue(0)

    let cardScale = $state(1)
    let cardRotate = $state(0)
    let gesture = $state<PinchInfo | null>(null)

    $effect(() => {
        const offScale = scale.on('change', (v) => (cardScale = v))
        const offRotate = rotate.on('change', (v) => (cardRotate = v))
        return () => {
            offScale()
            offRotate()
        }
    })

    const reset = () => {
        animate(scale, 1)
        animate(rotate, 0)
        animate(x, 0)
        animate(y, 0)
    }
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// pinch photo</span>
            <span class="micro readout" data-testid="pinch-photo-readout">
                scale {cardScale.toFixed(2)} · rotate {Math.round(cardRotate)}°
            </span>
        </div>

        <div class="frame">
            <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
                <motion.div
                    class="card"
                    data-testid="pinch-photo-card"
                    drag
                    dragMomentum={false}
                    pinch={{
                        scale: { min: 1, max: 4 },
                        rotate: { snap: 90 },
                        onMove: (_event, info) => (gesture = info),
                        onEnd: () => (gesture = null)
                    }}
                    whilePinch={{ boxShadow: '0 12px 40px #0006' }}
                    style={{ scale, rotate, x, y, boxShadow: '0 4px 12px #0003' }}
                />
            </LazyMotion>
        </div>

        <div class="strip-foot">
            <span class="micro">
                {#if gesture}
                    pinch ×{gesture.scale.toFixed(2)} · twist {Math.round(gesture.rotate)}°
                {:else}
                    Trackpad: pinch. Touch: pinch and twist with two fingers.
                {/if}
            </span>
            <button type="button" class="reset" onclick={reset}>Reset</button>
        </div>
        <span class="micro hint">
            Mouse: hold ctrl and scroll over the card. A trackpad twists only in Safari.
        </span>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem 0.75rem;
        min-height: 460px;
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

    /* The card can be scaled 4x and dragged anywhere: keep it inside. */
    .frame {
        position: relative;
        height: 340px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid var(--brut-rule, #d6dedb);
        background-color: var(--brut-paper-2, transparent);
    }

    :global(.dk-demo-shell .card) {
        width: min(300px, 80%);
        aspect-ratio: 3 / 2;
        border-radius: 20px;
        background: linear-gradient(135deg, #ff0088 0%, #8800ff 100%);
        cursor: grab;
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
