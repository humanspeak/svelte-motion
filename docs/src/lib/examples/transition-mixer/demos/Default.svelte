<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    import { interpolate } from 'flubber'

    // A star has 10 points and a square 4, so Motion can't blend their path
    // data by default. flubber can, so it becomes the mixer.
    const star = 'M50 6L61 38L95 38L67 58L78 92L50 72L22 92L33 58L5 38L39 38Z'
    const square = 'M14 14L86 14L86 86L14 86Z'

    let isStar = $state(true)

    // flubber's setup is costly and a mixer can be asked for the same pair
    // more than once, so it only runs when the returned function is first
    // called.
    const morph = (from: string, to: string) => {
        let mix: ReturnType<typeof interpolate> | undefined
        return (progress: number) => {
            mix ??= interpolate(from, to, { maxSegmentLength: 2 })
            return mix(progress)
        }
    }
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// transition-mixer</span>
            <button type="button" class="micro toggle" onclick={() => (isStar = !isStar)}>
                Morph to {isStar ? 'square' : 'star'}
            </button>
        </div>

        <div class="stage">
            <svg width="160" height="160" viewBox="0 0 100 100" aria-hidden="true">
                <!-- The mixer blends paths with different point counts -->
                <motion.path
                    class="shape"
                    d={star}
                    animate={{ d: isStar ? star : square }}
                    transition={{ duration: 0.8, ease: 'easeInOut', mixer: morph }}
                />
            </svg>
        </div>

        <div class="strip-foot">
            <span class="micro">star: 10 points</span>
            <span class="micro">square: 4 points</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 360px;
    }

    .strip {
        width: 100%;
        max-width: 28rem;
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

    .toggle {
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: transparent;
        padding: 0.25rem 0.6rem;
        color: var(--brut-accent, #247768);
        cursor: pointer;
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
        height: 200px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    :global(.dk-demo-shell .shape) {
        fill: var(--brut-accent, #247768);
        stroke: var(--brut-ink, #0a0a0a);
        stroke-width: 1;
    }
</style>
