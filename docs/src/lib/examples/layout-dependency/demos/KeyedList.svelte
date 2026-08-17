<script lang="ts">
    import { ArrowUpToLine, ListOrdered, RotateCcw } from '@lucide/svelte'
    import { motion } from '@humanspeak/svelte-motion'

    // A keyed list sorted by "last activity". Bumping a row moves it to the
    // top and displaces every row above it.
    type Row = { id: string; label: string; ts: number }
    let rows = $state<Row[]>([
        { id: 'a', label: 'Design review', ts: 5 },
        { id: 'b', label: 'Sprint planning', ts: 4 },
        { id: 'c', label: 'Bug triage', ts: 3 },
        { id: 'd', label: 'Release notes', ts: 2 },
        { id: 'e', label: 'On-call handoff', ts: 1 }
    ])
    let nextTs = 10

    // 'field': layoutDependency={row.ts} — only the bumped row's dependency
    // changes, so upstream (and we) animate only that row; the displaced rows
    // jump. 'index': layoutDependency={i} — every row whose slot changed has a
    // new dependency and animates.
    let gate = $state<'field' | 'index'>('field')

    const sorted = $derived([...rows].sort((x, y) => y.ts - x.ts))

    function bump(id: string) {
        rows = rows.map((row) => (row.id === id ? { ...row, ts: nextTs++ } : row))
    }

    function reset() {
        rows = rows.map((row, i) => ({ ...row, ts: rows.length - i }))
        nextTs = 10
    }
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="keyed list controls">
        <button
            type="button"
            class="primary"
            class:active={gate === 'index'}
            onclick={() => (gate = gate === 'field' ? 'index' : 'field')}
        >
            <ListOrdered size={15} />
            gate: {gate === 'field' ? 'row.ts (field)' : 'i (index)'}
        </button>
        <button type="button" onclick={reset}>
            <RotateCcw size={15} />
            Reset order
        </button>
    </div>

    <ul class="rows">
        {#each sorted as row, i (row.id)}
            <motion.li
                class="row"
                layout="position"
                layoutDependency={gate === 'field' ? row.ts : i}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
                <span class="label">{row.label}</span>
                <span class="meta">ts {row.ts}</span>
                <button
                    type="button"
                    class="bump"
                    aria-label={`Bump ${row.label} to the top`}
                    onclick={() => bump(row.id)}
                >
                    <ArrowUpToLine size={14} />
                </button>
            </motion.li>
        {/each}
    </ul>

    <p class="hint">
        {#if gate === 'field'}
            <code>layoutDependency={'{row.ts}'}</code> — bump a row: it slides up, the rows it
            displaces
            <strong>jump</strong> (their dependency didn't change).
        {:else}
            <code>layoutDependency={'{i}'}</code> — bump a row: every row whose slot changed slides.
        {/if}
    </p>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(520px, calc(100vh - 160px), 600px);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 16px;
        padding: 20px 26px;
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }

    button {
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 12px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        cursor: pointer;
    }

    button.primary {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    button.active {
        border-color: var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
        color: var(--brut-accent-ink, #f8fcfb);
    }

    .rows {
        list-style: none;
        margin: 0 auto;
        padding: 0;
        width: min(460px, 100%);
        display: grid;
        align-content: start;
        gap: 8px;
        min-height: 0;
    }

    :global(.row) {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: center;
        gap: 12px;
        height: 52px;
        padding: 0 8px 0 16px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    .label {
        font-weight: 700;
        font-size: 14px;
    }

    .meta {
        font-family: var(--brut-mono, monospace);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-accent, #247768);
    }

    button.bump {
        height: 32px;
        width: 32px;
        padding: 0;
        justify-content: center;
    }

    .hint {
        margin: 0;
        text-align: center;
        font-size: 13px;
        color: var(--brut-ink-2, #3a3a3a);
    }

    .hint code {
        font-family: var(--brut-mono, monospace);
        color: var(--brut-accent, #247768);
    }
</style>
