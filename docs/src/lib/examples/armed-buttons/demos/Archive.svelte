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

    const status = $derived(armedId ? `armed: ${armedId}` : 'idle')
    const archivedCount = $derived(archivedIds.size)

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
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// archive queue</span>
            <span class="micro state">{status}</span>
        </div>

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

        <div class="strip-foot">
            <span class="micro">disarm: 4s / spring 520·32</span>
            <span class="micro">archived: {String(archivedCount).padStart(2, '0')} / 03</span>
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
