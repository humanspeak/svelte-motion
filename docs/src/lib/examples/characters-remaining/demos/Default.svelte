<script lang="ts">
    import { motion, animate, transform } from '@humanspeak/svelte-motion'

    // Characters-remaining counter with a spring-bounce when getting
    // close to the limit. `transform` builds a value-mapping function
    // (a → b → c), and `animate(...)` runs an imperative spring keyed
    // by the remaining-character count.
    // Ported from: https://examples.motion.dev/react/characters-remaining

    let value = $state('')
    const maxLength = 12
    const charactersRemaining = $derived(maxLength - value.length)
    let counterEl: HTMLElement | null = $state(null)

    // Map remaining count to a colour gradient: at 6+ characters left
    // the counter sits muted grey; from 5 down to 2 it warms toward
    // pink; at 0 it's full pink.
    const mapRemainingToColor = transform([2, 6], ['#ff008c', '#ccc'])

    $effect(() => {
        if (charactersRemaining > 6 || !counterEl) return

        // The spring's velocity also scales with remaining count —
        // 5 left = subtle nudge; 0 left = aggressive bounce.
        const mapRemainingToSpringVelocity = transform([0, 5], [50, 0])

        animate(
            counterEl,
            { scale: 1 },
            {
                type: 'spring',
                velocity: mapRemainingToSpringVelocity(charactersRemaining),
                stiffness: 700,
                damping: 80
            }
        )
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// characters-remaining</span>
            <span class="micro readout">{charactersRemaining} left</span>
        </div>

        <div class="stage">
            <div class="input-container">
                <input bind:value placeholder="type here…" />
                <div class="counter">
                    <motion.span
                        bind:ref={counterEl}
                        style="color: {mapRemainingToColor(
                            charactersRemaining
                        )}; will-change: transform; display: block;"
                    >
                        {charactersRemaining}
                    </motion.span>
                </div>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">spring bounces near the limit</span>
            <span class="micro">max: {maxLength}</span>
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
        padding: 2rem 0;
    }

    .input-container {
        position: relative;
        font-size: 28px;
        line-height: 1;
    }

    .input-container input {
        position: relative;
        font-family: var(--brut-mono, monospace);
        font-size: 28px;
        line-height: 1;
        background-color: var(--brut-bg-2, #eef4f1);
        color: var(--brut-ink, #0a0a0a);
        border: 1px solid var(--brut-ink, #0a0a0a);
        padding: 18px 64px 18px 18px;
        width: 280px;
        outline: none;
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .input-container input::placeholder {
        color: var(--brut-ink-3, #9a9a9a);
    }

    .input-container input:focus {
        border-color: var(--brut-accent, #247768);
    }

    .counter {
        color: var(--brut-ink-2, #525252);
        background: linear-gradient(to right, transparent 0%, var(--brut-bg-2, #eef4f1) 45%);
        position: absolute;
        top: 50%;
        right: 1px;
        transform: translateY(-50%);
        padding: 10px 18px 10px 44px;
        font-family: var(--brut-mono, monospace);
        font-variant-numeric: tabular-nums;
    }
</style>
