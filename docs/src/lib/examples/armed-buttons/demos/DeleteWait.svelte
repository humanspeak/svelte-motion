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

    const removeAfterDeletedBeat = (id: string) => {
        window.setTimeout(() => {
            removedIds = new Set([...removedIds, id])
        }, 2000)
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
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
</div>

<style>
    .dk-demo-shell {
        display: flex;
        min-height: 260px;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    }

    .stack {
        display: grid;
        width: min(100%, 28rem);
        gap: 0.75rem;
    }
</style>
