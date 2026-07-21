<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
    import DeleteArmedWaitButton from '../DeleteArmedWaitButton.svelte'

    const rows = [
        { id: 'launch', title: 'Launch notes', eyebrow: 'Delete insight' },
        { id: 'pricing', title: 'Pricing objections', eyebrow: 'Delete thread' },
        { id: 'metrics', title: 'Retention metrics', eyebrow: 'Delete highlight' }
    ]

    let armedId = $state<string | null>(null)
    let removedIds = $state(new Set<string>())

    const visibleRows = $derived(rows.filter((row) => !removedIds.has(row.id)))
    const status = $derived(armedId ? `armed: ${armedId}` : 'idle')

    const removeAfterDeletedBeat = (id: string) => {
        window.setTimeout(() => {
            removedIds = new Set([...removedIds, id])
        }, 2000)
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// delete queue</span>
            <span class="micro state">{status}</span>
        </div>

        <div class="stack">
            <AnimatePresence mode="popLayout">
                {#each visibleRows as row (row.id)}
                    <motion.div
                        key={row.id}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -28, scale: 0.96, filter: 'blur(3px)' }}
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                    >
                        <DeleteArmedWaitButton
                            title={row.title}
                            eyebrow={row.eyebrow}
                            armed={armedId === row.id}
                            onArm={() => (armedId = row.id)}
                            onDisarm={() => {
                                if (armedId === row.id) armedId = null
                            }}
                            onDelete={() => removeAfterDeletedBeat(row.id)}
                        />
                    </motion.div>
                {/each}
            </AnimatePresence>
        </div>

        <div class="strip-foot">
            <span class="micro">countdown: 3s / disarm 10s</span>
            <span class="micro">rows: {String(visibleRows.length).padStart(2, '0')} / 03</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        min-height: 300px;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    }

    .strip {
        display: flex;
        width: min(100%, 28rem);
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

    .stack {
        display: grid;
        gap: 0.75rem;

        --armed-danger: #b91c1c;
        --armed-danger-soft: rgba(185, 28, 28, 0.12);
    }

    :global(.dark) .stack {
        --armed-danger: #ef5350;
        --armed-danger-soft: rgba(239, 83, 80, 0.16);
    }
</style>
