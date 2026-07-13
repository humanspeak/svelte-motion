<script lang="ts">
    import { motion, type ProjectionUpdatePayload } from '$lib'

    // Characterization demo (Plan 004, #437) — scroll-during-layout.
    //
    // Two `<motion.div layout>` boxes sit near the TOP of the page so they are
    // visible on load without any scroll, while a tall spacer BELOW makes the
    // page scrollable (and lets the boxes be scrolled fully offscreen). A fixed
    // toolbar toggle reverses their order, so each box travels one row (~96px)
    // and the layout animation runs.
    //
    // The point of this page is to expose how today's projection commit path
    // behaves when the viewport is scrolled between layout snapshots:
    //   - No scroll  → the swap animates (FLIP translate decays over frames).
    //   - After a viewport scroll → today's `wasViewportScrolledSinceLastLayout`
    //     heuristic SKIPS the layout animation, so the boxes snap.
    //   - Element offscreen then back → today may produce a spurious/absent
    //     animation depending on the offscreen heuristic.
    //
    // Plan 004 migrates measurement to scroll-invariant page space so the
    // scroll heuristic can be deleted and every case animates cleanly. The
    // e2e spec encodes cases 2-3 as `test.fail()` until that lands.

    type Item = { id: number; label: string; color: string }
    let items = $state<Item[]>([
        { id: 0, label: 'Box A', color: '#6366f1' },
        { id: 1, label: 'Box B', color: '#ec4899' }
    ])

    let lastDelta = $state<Record<number, ProjectionUpdatePayload>>({})
    let swapCount = $state(0)

    const swap = () => {
        items = [...items].reverse()
        swapCount += 1
    }
</script>

<svelte:head>
    <title>Projection · scroll during layout (#437)</title>
</svelte:head>

<div class="page" data-testid="scroll-during-layout">
    <div class="toolbar">
        <button type="button" onclick={swap} data-testid="toggle">Swap order</button>
        <span class="count" data-testid="swap-count">swaps: {swapCount}</span>
        <span class="hint">Swap with no scroll → animates. Scroll first → snaps (today).</span>
    </div>

    <section class="stage" data-testid="stage">
        <h1>Scroll-during-layout characterization</h1>
        <p>
            These two layout boxes are visible on load. Hit <strong>Swap order</strong> with no scroll
            and they animate. Scroll the page first, then swap, and today's heuristic makes them snap
            instead. Scroll all the way down to push them offscreen, swap, and scroll back to see the
            offscreen case.
        </p>
        <div class="stack">
            {#each items as item (item.id)}
                <motion.div
                    layout
                    class="box"
                    data-testid="box-{item.id}"
                    style="background: {item.color};"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    onProjectionUpdate={(data) => {
                        lastDelta = { ...lastDelta, [item.id]: data }
                    }}
                >
                    {item.label}
                </motion.div>
            {/each}
        </div>

        <div class="readout">
            {#each items as item (item.id)}
                <pre data-testid="delta-{item.id}">{item.label}: {lastDelta[item.id]
                        ? `Δx=${lastDelta[item.id].delta.x.translate.toFixed(1)} Δy=${lastDelta[
                              item.id
                          ].delta.y.translate.toFixed(
                              1
                          )} changed=${lastDelta[item.id].hasLayoutChanged}`
                        : '(no event yet)'}</pre>
            {/each}
        </div>
    </section>

    <section class="spacer bottom">
        <p>↓ Extra height below so the boxes can be scrolled fully offscreen and back. ↓</p>
    </section>
</div>

<style>
    .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 1rem;
        font-family: ui-sans-serif, system-ui, sans-serif;
        color: #0f172a;
    }
    .toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        background: #0f172a;
        color: #f8fafc;
    }
    .toolbar button {
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid #334155;
        background: #f8fafc;
        color: #0f172a;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
    }
    .toolbar .count {
        font-family: ui-monospace, monospace;
        font-size: 13px;
    }
    .toolbar .hint {
        font-size: 13px;
        color: #cbd5e1;
    }
    .spacer.bottom {
        min-height: 2000px;
        padding-top: 40px;
        color: #64748b;
    }
    .stage {
        padding: 24px 0;
        margin-top: 56px;
        border-bottom: 2px dashed #cbd5e1;
    }
    .stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin: 16px 0;
    }
    :global([data-testid='scroll-during-layout'] .box) {
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
