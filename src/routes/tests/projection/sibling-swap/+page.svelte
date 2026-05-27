<script lang="ts">
    import { motion, type ProjectionUpdatePayload } from '$lib'

    // Projection smoke test (#379) — flat sibling swap.
    //
    // Two `<motion.div layout>` boxes. Clicking swap flips their order in a
    // $state array; the existing FLIP layout animation runs, and each box's
    // internal ProjectionNode fires `onProjectionUpdate` with the delta
    // between its pre- and post-swap layout box. We render the live payload
    // so the event stream is verifiable without opening DevTools.

    type Item = { id: number; label: string; color: string }
    let items = $state<Item[]>([
        { id: 0, label: 'Box A', color: '#6366f1' },
        { id: 1, label: 'Box B', color: '#ec4899' }
    ])

    let lastDelta = $state<Record<number, ProjectionUpdatePayload>>({})

    const swap = () => {
        items = [...items].reverse()
    }
</script>

<svelte:head>
    <title>Projection · sibling swap (#379)</title>
</svelte:head>

<div class="page" data-testid="projection-sibling-swap">
    <header>
        <h1>Projection — sibling swap</h1>
        <p>
            Two <code>&lt;motion.div layout&gt;</code> boxes. Click swap → the FLIP animation runs
            and each box's projection node emits a <code>didUpdate</code> with the move delta.
            Expect
            <code>delta.y.translate</code> ≈ one box-height (one positive, one negative) and
            <code>hasLayoutChanged: true</code>.
        </p>
        <button type="button" onclick={swap} data-testid="swap">Swap order</button>
    </header>

    <section class="stack">
        {#each items as item (item.id)}
            <motion.div
                layout
                class="box"
                style="background: {item.color};"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                onProjectionUpdate={(data) => {
                    lastDelta = { ...lastDelta, [item.id]: data }
                }}
            >
                {item.label}
            </motion.div>
        {/each}
    </section>

    <section class="readout">
        <h2>Last delta per box</h2>
        {#each items as item (item.id)}
            <pre data-testid="delta-{item.id}">{item.label}: {lastDelta[item.id]
                    ? `Δx=${lastDelta[item.id].delta.x.translate.toFixed(1)} Δy=${lastDelta[
                          item.id
                      ].delta.y.translate.toFixed(
                          1
                      )} changed=${lastDelta[item.id].hasLayoutChanged}`
                    : '(no event yet)'}</pre>
        {/each}
    </section>
</div>

<style>
    .page {
        max-width: 640px;
        margin: 0 auto;
        padding: 2rem 1rem;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    header p {
        color: #475569;
        font-size: 14px;
        line-height: 1.5;
    }
    button {
        margin-top: 8px;
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
        font: inherit;
    }
    button:hover {
        border-color: #94a3b8;
    }
    .stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin: 24px 0;
    }
    :global([data-testid='projection-sibling-swap'] .box) {
        height: 80px;
        border-radius: 12px;
        color: #fff;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .readout pre {
        margin: 4px 0;
        font-family: ui-monospace, monospace;
        font-size: 13px;
        color: #0f172a;
        background: #f1f5f9;
        padding: 6px 10px;
        border-radius: 6px;
    }
</style>
