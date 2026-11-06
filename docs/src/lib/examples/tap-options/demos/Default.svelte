<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    // The `tap` prop turns one tap gesture into a double tap (`count`), a
    // long press (`hold`) or an auto-repeating stepper (`repeat`).
    // `whileTap` and `onTapStart` start on the first press; `onTap` fires
    // when the gesture completes, and on every repeat.

    let likes = $state(0)
    let deleted = $state(0)
    let value = $state(0)
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// tap options</span>
            <span class="micro readout">count · hold · repeat</span>
        </div>

        <div class="stage">
            <!-- Double tap: onTap needs two quick presses -->
            <div class="cell">
                <motion.button
                    type="button"
                    class="pad"
                    aria-label="Double tap to like"
                    tap={{ count: 2 }}
                    whileTap={{ scale: 0.9 }}
                    onTap={() => likes++}
                >
                    <span class="glyph">♥</span>
                </motion.button>
                <span class="micro">double tap · {likes}</span>
            </div>

            <!-- Long press: onTap after holding half a second -->
            <div class="cell">
                <motion.button
                    type="button"
                    class="pad danger"
                    aria-label="Hold to delete"
                    tap={{ hold: 0.5 }}
                    whileTap={{ scale: 0.9 }}
                    onTap={() => deleted++}
                >
                    <span class="glyph">✕</span>
                </motion.button>
                <span class="micro">hold · {deleted}</span>
            </div>

            <!-- Stepper: onTap every 0.1 seconds while held -->
            <div class="cell">
                <div class="stepper">
                    <motion.button
                        type="button"
                        class="step"
                        aria-label="Decrease"
                        tap={{ repeat: 0.1 }}
                        whileTap={{ scale: 0.9 }}
                        onTap={() => value--}
                    >
                        −
                    </motion.button>
                    <span class="value">{value}</span>
                    <motion.button
                        type="button"
                        class="step"
                        aria-label="Increase"
                        tap={{ repeat: 0.1 }}
                        whileTap={{ scale: 0.9 }}
                        onTap={() => value++}
                    >
                        +
                    </motion.button>
                </div>
                <span class="micro">repeat</span>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">tap=&#123;&#123; count | hold | repeat &#125;&#125;</span>
            <span class="micro">press and hold</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 300px;
    }

    .strip {
        width: 100%;
        max-width: 32rem;
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
        min-height: 10rem;
        display: flex;
        align-items: center;
        justify-content: space-around;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.6rem;
    }

    :global(.dk-demo-shell .pad) {
        width: 72px;
        height: 72px;
        border: 1px solid var(--brut-accent, #247768);
        background-color: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        color: var(--brut-accent, #247768);
        cursor: pointer;
    }

    :global(.dk-demo-shell .pad.danger) {
        border-color: #c2410c;
        background-color: rgba(194, 65, 12, 0.1);
        color: #c2410c;
    }

    .glyph {
        font-size: 1.5rem;
        line-height: 1;
    }

    .stepper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    :global(.dk-demo-shell .step) {
        width: 40px;
        height: 40px;
        border: 1px solid var(--brut-accent, #247768);
        background-color: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
        color: var(--brut-accent, #247768);
        font-size: 1.25rem;
        cursor: pointer;
    }

    .value {
        min-width: 3ch;
        text-align: center;
        font-family: var(--brut-mono, monospace);
        font-size: 1.25rem;
        color: var(--brut-ink, #0a0a0a);
    }
</style>
