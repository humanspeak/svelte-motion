<script lang="ts">
    import { SvelteSet } from 'svelte/reactivity'
    import ArchiveArmedButton from '../ArchiveArmedButton.svelte'

    const rows = [
        { id: 'launch', title: 'Launch notes', eyebrow: 'Shared insight' },
        { id: 'pricing', title: 'Pricing objections', eyebrow: 'Saved thread' },
        { id: 'metrics', title: 'Retention metrics', eyebrow: 'Team highlight' }
    ]

    let armedId = $state<string | null>(null)
    const archivedIds = new SvelteSet<string>()

    $effect(() => {
        if (!armedId) return
        const timer = window.setTimeout(() => {
            armedId = null
        }, 4000)

        return () => window.clearTimeout(timer)
    })

    const toggleArchiveRow = (id: string) => {
        if (archivedIds.has(id)) {
            archivedIds.delete(id)
        } else {
            archivedIds.add(id)
        }
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
                onArchive={() => toggleArchiveRow(row.id)}
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
