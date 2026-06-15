<script lang="ts">
    import ArchiveArmedButton from '../ArchiveArmedButton.svelte'

    const rows = [
        { id: 'launch', title: 'Launch notes', eyebrow: 'Shared insight' },
        { id: 'pricing', title: 'Pricing objections', eyebrow: 'Saved thread' },
        { id: 'metrics', title: 'Retention metrics', eyebrow: 'Team highlight' }
    ]

    let armedId = $state<string | null>(null)
    let archivedIds = $state(new Set<string>())

    $effect(() => {
        if (!armedId) return
        const timer = window.setTimeout(() => {
            armedId = null
        }, 4000)

        return () => window.clearTimeout(timer)
    })

    const archiveRow = (id: string) => {
        archivedIds = new Set([...archivedIds, id])
        armedId = null
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="stack">
        {#each rows as row (row.id)}
            <ArchiveArmedButton
                id={row.id}
                title={row.title}
                eyebrow={row.eyebrow}
                armed={armedId === row.id}
                archived={archivedIds.has(row.id)}
                onArm={() => (armedId = row.id)}
                onDisarm={() => {
                    if (armedId === row.id) armedId = null
                }}
                onArchive={() => archiveRow(row.id)}
            />
        {/each}
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
