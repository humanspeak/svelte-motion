<script lang="ts">
    import { arc, motion } from '@humanspeak/svelte-motion'

    let right = $state(false)
    let strength = $state(0.5)
    let direction = $state<'cw' | 'ccw' | undefined>(undefined)

    // arc() keeps auto-direction continuity state, so recreate the path only
    // when an option changes instead of evaluating a fresh path per render.
    const transition = $derived({
        duration: 0.9,
        ease: 'easeInOut' as const,
        path: arc({ strength, direction })
    })

    const directions = [undefined, 'cw', 'ccw'] as const
    const cycleDirection = () => {
        const index = directions.indexOf(direction)
        direction = directions[(index + 1) % directions.length]
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <header>
            <span class="micro">// transition.path</span>
            <span class="micro readout">strength {strength} · {direction ?? 'auto'}</span>
        </header>

        <button
            class="stage"
            type="button"
            aria-label="Move the box along an arc"
            onclick={() => (right = !right)}
        >
            <motion.div
                class="box"
                initial={{ x: 0, y: 0 }}
                animate={{ x: right ? 260 : 0, y: 0 }}
                {transition}
            />
        </button>

        <div class="controls">
            <span class="micro">strength</span>
            {#each [0.25, 0.5, 1] as value (value)}
                <button
                    type="button"
                    class:active={strength === value}
                    onclick={() => (strength = value)}
                >
                    {value}
                </button>
            {/each}
            <button type="button" class="direction" onclick={cycleDirection}>
                direction: {direction ?? 'auto'}
            </button>
        </div>

        <footer>
            <span class="micro">click the stage</span>
            <span class="micro">quadratic arc</span>
        </footer>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 310px;
        padding: 1.5rem;
    }

    .strip {
        display: flex;
        width: 100%;
        max-width: 390px;
        flex-direction: column;
        gap: 0.75rem;
    }

    header,
    footer,
    .controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    header,
    footer {
        justify-content: space-between;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    footer {
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        border-bottom: 0;
        padding-top: 0.5rem;
        padding-bottom: 0;
    }

    .micro {
        color: var(--brut-ink-3, #6f7975);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
    }

    .stage {
        position: relative;
        height: 180px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background:
            linear-gradient(
                90deg,
                transparent 49.8%,
                var(--brut-rule, #d6dedb) 50%,
                transparent 50.2%
            ),
            var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        cursor: pointer;
    }

    :global(.box) {
        position: absolute;
        top: 66px;
        left: 24px;
        width: 48px;
        height: 48px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-accent, #247768);
    }

    .controls {
        flex-wrap: wrap;
    }

    .controls button {
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        padding: 0.3rem 0.55rem;
        background: var(--brut-bg, #fff);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.7rem;
        cursor: pointer;
    }

    .controls button.active {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent, #247768);
        color: white;
    }

    .controls .direction {
        margin-left: auto;
    }
</style>
