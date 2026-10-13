<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    type Latest = Record<string, string | number>

    let latest = $state<Latest>({})
    let frames = $state(0)

    // Called once per frame while any value changes, with every latest value.
    const onUpdate = (values: Latest) => {
        latest = { ...values }
        frames += 1
    }

    const format = (value: string | number | undefined) =>
        typeof value === 'number' ? value.toFixed(1) : (value ?? '—')
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// on-update</span>
            <span class="micro state">frames: {frames}</span>
        </div>

        <div class="track">
            <motion.div
                class="box"
                animate={{ x: [0, 220], rotate: [0, 180] }}
                transition={{
                    duration: 2,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    repeatType: 'reverse'
                }}
                {onUpdate}
            />
        </div>

        <dl class="readout" aria-live="off">
            <div>
                <dt class="micro">latest.x</dt>
                <dd>{format(latest.x)}</dd>
            </div>
            <div>
                <dt class="micro">latest.rotate</dt>
                <dd>{format(latest.rotate)}</dd>
            </div>
        </dl>

        <div class="strip-foot">
            <span class="micro">onUpdate(latest)</span>
            <span class="micro">every value, every frame</span>
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

    .state {
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

    .track {
        position: relative;
        height: 120px;
        padding: 30px 16px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    :global(.dk-demo-shell .box) {
        width: 60px;
        height: 60px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-accent, #247768);
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
    }

    .readout {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin: 0;
    }

    .readout dd {
        margin: 0.25rem 0 0;
        font-family: var(--brut-mono, monospace);
        font-size: 1.25rem;
        font-variant-numeric: tabular-nums;
        color: var(--brut-ink, #0a0a0a);
    }
</style>
