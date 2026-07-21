<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // Multi-property keyframe animation: scale + rotate + borderRadius.
    // Each property is given its own value sequence; `times` aligns
    // every keyframe to a normalised t in [0, 1].
    // Ported from the motion.dev keyframes example.
    const times = [0, 0.2, 0.5, 0.8, 1]
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// keyframes</span>
            <span class="micro readout">times [{times.join(', ')}]</span>
        </div>

        <div class="stage">
            <motion.div
                style={styleString(() => ({ width: 100, height: 100, backgroundColor: '#ff0088' }))}
                animate={{
                    scale: [1, 2, 2, 1, 1],
                    rotate: [0, 0, 180, 180, 0],
                    borderRadius: ['0%', '0%', '50%', '50%', '0%']
                }}
                transition={{
                    duration: 2,
                    ease: 'easeInOut',
                    times,
                    repeat: Infinity,
                    repeatDelay: 1
                }}
            />
        </div>

        <div class="strip-foot">
            <span class="micro">scale · rotate · radius</span>
            <span class="micro">duration: 2s / loop</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 480px;
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
        height: 16rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: var(--brut-bg-2, #eef4f1);
    }
</style>
