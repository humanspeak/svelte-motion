<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import { layoutMeasureStats } from '$lib/utils/motionDomProjection'

    // A high-frequency render driver. Each tick changes both boxes' inline
    // `style` (the background hue), forcing a re-render that — without
    // `layoutDependency` — re-measures the layout box every single time.
    let tick = $state(0)

    // The gate value. Bumping this is the ONLY thing that should let the
    // gated box re-measure.
    let dep = $state(0)

    // Toggles a container modifier so both boxes physically move (a real
    // FLIP-able layout change) when we choose to reflow.
    let shifted = $state(false)

    // Measurement counters: each box increments when its render-driven
    // projection cycle actually runs (onProjectionUpdate fires).
    let defaultMeasures = $state(0)
    let gatedMeasures = $state(0)

    // Escape-hatch sections (upstream MeasureLayout parity).
    // Drag: a gated box with `drag` should ignore the gate and keep measuring.
    let dragMeasures = $state(0)
    let noDragMeasures = $state(0)
    // Presence: a gated box whose SIBLING toggles via AnimatePresence must NOT
    // measure — upstream only re-snapshots on the element's OWN presence flip
    // (MeasureLayout.tsx `prevProps.isPresent !== isPresent`), so a sibling
    // reflow with an unchanged dependency jumps.
    let presenceMeasures = $state(0)
    let siblingPresent = $state(true)

    // Keyed list (#470): rows gated on a PER-ROW field. Bumping one row's
    // timestamp re-sorts the list. Upstream only measures the row whose
    // dependency changed; the rows it displaces have an unchanged dependency
    // and jump. Gate on the row's index instead to animate every row that
    // moves — that value changes for exactly the rows whose slot changed.
    type Row = { id: string; ts: number }
    let rows = $state<Row[]>([
        { id: 'a', ts: 5 },
        { id: 'b', ts: 4 },
        { id: 'c', ts: 3 },
        { id: 'd', ts: 2 },
        { id: 'e', ts: 1 }
    ])
    let nextTs = 10
    let listGate = $state<'field' | 'index'>('field')
    const sortedRows = $derived([...rows].sort((x, y) => y.ts - x.ts))
    let rowMeasures = $state<Record<string, number>>({})
    // `onLayoutMeasure` counter per row: a gated row that merely gets
    // re-slotted must not surface a measurement (upstream never runs
    // `updateLayout()` for it), so this stays flat for displaced rows.
    // Deliberately NON-reactive (a plain object on `window`, read by the e2e
    // via `page.evaluate`): `onLayoutMeasure` fires from inside layout effects,
    // and writing `$state` there re-enters the measure cycle.
    const rowLayoutMeasures: Record<string, number> = {}
    if (typeof window !== 'undefined') {
        const w = window as unknown as {
            __rowLayoutMeasures: Record<string, number>
            __layoutMeasureStats: typeof layoutMeasureStats
        }
        w.__rowLayoutMeasures = rowLayoutMeasures
        // Library-internal DOM-read counters (public callbacks can't see the
        // silent cache refresh a gated element does when a sibling re-slots it).
        w.__layoutMeasureStats = layoutMeasureStats
    }

    // Own-presence escape hatch: upstream also snapshots when THIS element's
    // isPresent flips (exit / re-entry), regardless of the dependency.
    let selfPresent = $state(true)
    let selfPresenceMeasures = $state(0)

    // Wait-mode parent: a `layout` parent wrapping AnimatePresence
    // mode="wait". A child swap is a CHILD's presence change, so a gated
    // parent must not FLIP from the held box to its new size; the ungated
    // parent keeps our hold/release size animation.
    let waitChild = $state<'a' | 'b'>('a')
    let gatedWaitChild = $state<'a' | 'b'>('a')

    function bumpRow(id: string) {
        rows = rows.map((row) => (row.id === id ? { ...row, ts: nextTs++ } : row))
    }

    function countRowMeasure(id: string) {
        rowMeasures = { ...rowMeasures, [id]: (rowMeasures[id] ?? 0) + 1 }
    }

    function countRowLayoutMeasure(id: string) {
        rowLayoutMeasures[id] = (rowLayoutMeasures[id] ?? 0) + 1
    }

    let autoTicking = $state(false)

    const hue = $derived(tick % 360)
    const boxStyle = $derived(`background: hsl(${hue} 85% 60%)`)

    function tickOnce() {
        tick += 1
    }

    // Reflow: move the boxes AND bump the gate. The tick bump lets the
    // ungated box re-render into its new position; the dep bump is what lets
    // the gated box measure and FLIP-animate to the same new position.
    function reflow() {
        shifted = !shifted
        tick += 1
        dep += 1
    }

    function resetCounters() {
        defaultMeasures = 0
        gatedMeasures = 0
        dragMeasures = 0
        noDragMeasures = 0
        presenceMeasures = 0
        selfPresenceMeasures = 0
        rowMeasures = {}
        for (const id of Object.keys(rowLayoutMeasures)) rowLayoutMeasures[id] = 0
        layoutMeasureStats.reads = 0
        layoutMeasureStats.silentReads = 0
    }

    function toggleSibling() {
        siblingPresent = !siblingPresent
    }

    // Only spin the rAF loop while auto-render is on.
    $effect(() => {
        if (!autoTicking) return
        let raf = requestAnimationFrame(function loop() {
            tick += 1
            raf = requestAnimationFrame(loop)
        })
        return () => cancelAnimationFrame(raf)
    })
</script>

<svelte:head>
    <title>layoutDependency</title>
</svelte:head>

<main>
    <section class="intro">
        <p class="kicker">layoutDependency (#314)</p>
        <h1>Re-measure only when it matters.</h1>
        <p>
            Both boxes have <code>layout</code> and re-render constantly (their color cycles every
            frame). The left box re-measures on <em>every</em> render. The right box passes
            <code>layoutDependency={'{dep}'}</code>, so it only re-measures when <code>dep</code> changes
            — watch its measure counter stay flat while it shimmers.
        </p>
    </section>

    <section class="controls" data-testid="controls">
        <button type="button" data-testid="tick" onclick={tickOnce}>Render once</button>
        <button
            type="button"
            data-testid="toggle-auto"
            onclick={() => (autoTicking = !autoTicking)}
        >
            {autoTicking ? 'Stop' : 'Start'} auto-render
        </button>
        <button type="button" data-testid="reflow" onclick={reflow}>Reflow + bump dep</button>
        <button type="button" data-testid="reset" onclick={resetCounters}>Reset counters</button>
        <span class="readout" data-testid="tick-count">renders: {tick}</span>
    </section>

    <section class="grid" class:shifted>
        <article>
            <h2>Default (no gate)</h2>
            <p class="expectation">
                Re-measures on every render. Measure counter climbs with the render count.
            </p>
            <p class="measure" data-testid="default-measures">measures: {defaultMeasures}</p>
            <div class="track">
                <motion.div
                    class="orb"
                    data-testid="default-box"
                    layout
                    style={boxStyle}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    onProjectionUpdate={() => (defaultMeasures += 1)}
                >
                    A
                </motion.div>
            </div>
        </article>

        <article>
            <h2>Gated (layoutDependency)</h2>
            <p class="expectation">
                Same renders, but measurement is gated on <code>dep</code>. Counter only moves on
                Reflow.
            </p>
            <p class="measure" data-testid="gated-measures">measures: {gatedMeasures}</p>
            <div class="track">
                <motion.div
                    class="orb"
                    data-testid="gated-box"
                    layout
                    layoutDependency={dep}
                    style={boxStyle}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    onProjectionUpdate={() => (gatedMeasures += 1)}
                >
                    B
                </motion.div>
            </div>
        </article>
    </section>

    <section class="escape">
        <h2 class="section-title">Escape hatches (upstream parity)</h2>
        <p class="section-note">
            Upstream <code>MeasureLayout</code> ignores the gate while <code>drag</code> is set, and
            re-snapshots on the element's <em>own</em> presence flip — nothing else. These panels
            hold the dependency constant (never bumped) and show that a sibling's presence toggle
            does
            <strong>not</strong> re-measure a gated box.
        </p>

        <div class="grid">
            <article>
                <h2>drag forces measurement</h2>
                <p class="expectation">
                    Both boxes are gated with a constant <code>layoutDependency={0}</code>. The left
                    also has <code>drag</code> — so renders re-measure it; the right stays flat.
                </p>
                <div class="readouts">
                    <p class="measure" data-testid="drag-measures">drag: {dragMeasures}</p>
                    <p class="measure muted" data-testid="nodrag-measures">
                        no-drag: {noDragMeasures}
                    </p>
                </div>
                <div class="track two">
                    <motion.div
                        class="orb"
                        data-testid="drag-box"
                        layout
                        layoutDependency={0}
                        drag
                        dragSnapToOrigin
                        style={boxStyle}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        onProjectionUpdate={() => (dragMeasures += 1)}
                    >
                        D
                    </motion.div>
                    <motion.div
                        class="orb"
                        data-testid="nodrag-box"
                        layout
                        layoutDependency={0}
                        style={boxStyle}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        onProjectionUpdate={() => (noDragMeasures += 1)}
                    >
                        N
                    </motion.div>
                </div>
            </article>

            <article>
                <h2>sibling presence reflow (stays gated)</h2>
                <p class="expectation">
                    The gated box (constant <code>layoutDependency={0}</code>) ignores renders —
                    and, matching upstream, also ignores the reflow when its AnimatePresence sibling
                    enters/exits. Its dependency didn't change, so it jumps to the new slot.
                </p>
                <div class="panel-controls">
                    <button type="button" data-testid="toggle-sibling" onclick={toggleSibling}>
                        Toggle sibling
                    </button>
                    <p class="measure" data-testid="presence-measures">
                        measures: {presenceMeasures}
                    </p>
                </div>
                <div class="track column">
                    <AnimatePresence>
                        {#if siblingPresent}
                            <motion.div
                                key="presence-sibling"
                                class="sibling"
                                data-testid="presence-sibling"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }}
                            >
                                sibling
                            </motion.div>
                        {/if}
                    </AnimatePresence>
                    <motion.div
                        class="orb"
                        data-testid="presence-gated-box"
                        layout
                        layoutDependency={0}
                        style={boxStyle}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        onProjectionUpdate={() => (presenceMeasures += 1)}
                    >
                        C
                    </motion.div>
                </div>
            </article>
        </div>
    </section>

    <section class="escape" data-testid="own-presence-section">
        <h2 class="section-title">Own presence & wait-mode parent (upstream parity)</h2>
        <p class="section-note">
            Upstream re-snapshots a gated element when <em>its own</em> presence flips (exit /
            re-entry) — but a <code>layout</code> parent whose
            <code>AnimatePresence mode="wait"</code>
            child swaps is only seeing a <em>child's</em> presence change, so a gated parent must not
            FLIP to its new size. The ungated parent keeps the hold/release size animation.
        </p>
        <div class="grid">
            <article>
                <h2>own presence flip measures</h2>
                <p class="expectation">
                    Gated (<code>layoutDependency={0}</code>) owned child of
                    <code>AnimatePresence present child</code> — the real node stays mounted for its
                    exit, so its own <code>isPresent</code> flips in place. Renders never measure
                    it; toggling <em>its own</em> presence does.
                </p>
                <div class="panel-controls">
                    <button
                        type="button"
                        data-testid="toggle-self"
                        onclick={() => (selfPresent = !selfPresent)}
                    >
                        Toggle self
                    </button>
                    <p class="measure" data-testid="self-presence-measures">
                        measures: {selfPresenceMeasures}
                    </p>
                </div>
                <div class="track">
                    <AnimatePresence present={selfPresent}>
                        {#snippet child()}
                            <motion.div
                                class="orb"
                                data-testid="self-presence-box"
                                layout
                                layoutDependency={0}
                                style={boxStyle}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                onProjectionUpdate={() => (selfPresenceMeasures += 1)}
                            >
                                S
                            </motion.div>
                        {/snippet}
                    </AnimatePresence>
                </div>
            </article>

            <article>
                <h2>wait-mode parent: gated vs ungated</h2>
                <p class="expectation">
                    Both parents have <code>layout</code> and wrap an
                    <code>AnimatePresence mode="wait"</code>
                    swapping a small child for a large one. The ungated parent animates its size; the
                    gated parent (<code>layoutDependency={0}</code>) jumps.
                </p>
                <div class="panel-controls">
                    <button
                        type="button"
                        data-testid="swap-wait-child"
                        onclick={() => (waitChild = waitChild === 'a' ? 'b' : 'a')}
                    >
                        Swap ungated ({waitChild})
                    </button>
                    <button
                        type="button"
                        data-testid="swap-gated-wait-child"
                        onclick={() => (gatedWaitChild = gatedWaitChild === 'a' ? 'b' : 'a')}
                    >
                        Swap gated ({gatedWaitChild})
                    </button>
                </div>
                <div class="track two wait-track">
                    <motion.div
                        class="wait-parent"
                        data-testid="wait-parent"
                        layout
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            {#if waitChild === 'a'}
                                <motion.div
                                    key="a"
                                    class="wait-child small"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    a
                                </motion.div>
                            {:else}
                                <motion.div
                                    key="b"
                                    class="wait-child large"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    b
                                </motion.div>
                            {/if}
                        </AnimatePresence>
                    </motion.div>
                    <motion.div
                        class="wait-parent gated"
                        data-testid="gated-wait-parent"
                        layout
                        layoutDependency={0}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            {#if gatedWaitChild === 'a'}
                                <motion.div
                                    key="a"
                                    class="wait-child small"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    a
                                </motion.div>
                            {:else}
                                <motion.div
                                    key="b"
                                    class="wait-child large"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    b
                                </motion.div>
                            {/if}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </article>
        </div>
    </section>

    <section class="escape" data-testid="keyed-list-section">
        <h2 class="section-title">Keyed list (#470)</h2>
        <p class="section-note">
            Every row is <code>layout="position"</code>. With <code>List gate: field</code> each row
            passes <code>layoutDependency={'{row.ts}'}</code>; bumping E re-sorts it to the top, but
            only E's dependency changed — the four rows it displaces jump (upstream parity). Switch
            to
            <code>List gate: index</code> and every row whose slot changed animates.
        </p>
        <div class="panel-controls">
            <button type="button" data-testid="bump-row-e" onclick={() => bumpRow('e')}>
                Bump row E
            </button>
            <button
                type="button"
                data-testid="toggle-list-gate"
                onclick={() => (listGate = listGate === 'field' ? 'index' : 'field')}
            >
                List gate: {listGate}
            </button>
        </div>
        <ul class="rows" data-testid="keyed-list">
            {#each sortedRows as row, i (row.id)}
                <motion.li
                    class="row"
                    data-testid={`row-${row.id}`}
                    layout="position"
                    layoutDependency={listGate === 'field' ? row.ts : i}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    onProjectionUpdate={() => countRowMeasure(row.id)}
                    onLayoutMeasure={() => countRowLayoutMeasure(row.id)}
                >
                    <span>{row.id}</span>
                    <span class="row-meta">ts {row.ts} · measures {rowMeasures[row.id] ?? 0}</span>
                </motion.li>
            {/each}
        </ul>
    </section>
</main>

<style>
    /* Layout/scroll is owned centrally by app.css (.container/#sandbox +
       html/body). Only theme the page here. */
    :global(html),
    :global(body) {
        background: #071012;
        color: #ecfdf5;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    main {
        min-height: 100vh;
        width: min(1080px, calc(100vw - 32px));
        display: grid;
        align-content: center;
        gap: 28px;
        margin: 0 auto;
        padding: 48px 0;
    }

    .intro {
        max-width: 760px;
    }

    .kicker {
        margin: 0 0 8px;
        color: #67e8f9;
        font-size: 13px;
        font-weight: 850;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: clamp(34px, 5vw, 56px);
        line-height: 0.95;
    }

    .intro p:not(.kicker) {
        margin: 14px 0 0;
        color: #b7d4d8;
        font-size: 16px;
        line-height: 1.65;
    }

    code {
        color: #f0abfc;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
    }

    .readout {
        margin-left: 6px;
        color: #a9c9cf;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 13px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
    }

    article {
        display: grid;
        align-content: start;
        gap: 14px;
        padding: 24px;
        border: 1px solid rgba(125, 211, 252, 0.3);
        background: #0b171a;
        overflow: hidden;
    }

    h2 {
        margin: 0;
        color: #dff8ff;
        font-size: 18px;
    }

    .expectation {
        margin: 0;
        color: #a9c9cf;
        font-size: 13px;
        line-height: 1.45;
    }

    .measure {
        margin: 0;
        color: #67e8f9;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 15px;
        font-weight: 800;
    }

    .track {
        display: flex;
        justify-content: flex-start;
        padding: 12px;
        border: 1px dashed rgba(125, 211, 252, 0.24);
        min-height: 140px;
        align-items: center;
    }

    /* Reflow moves the box to the opposite edge — a real layout change. */
    .grid.shifted .track {
        justify-content: flex-end;
    }

    .track.two {
        justify-content: space-between;
    }

    .track.column {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }

    .escape {
        display: grid;
        gap: 14px;
        margin-top: 8px;
        padding-top: 24px;
        border-top: 1px solid rgba(125, 211, 252, 0.18);
    }

    .section-title {
        margin: 0;
        color: #dff8ff;
        font-size: 20px;
    }

    .section-note {
        margin: 0 0 4px;
        max-width: 760px;
        color: #a9c9cf;
        font-size: 14px;
        line-height: 1.55;
    }

    .readouts {
        display: flex;
        gap: 18px;
    }

    .measure.muted {
        color: #64748b;
    }

    :global(.sibling) {
        width: 100%;
        padding: 14px 16px;
        border: 1px solid rgba(125, 211, 252, 0.35);
        background: rgba(56, 189, 248, 0.12);
        color: #bae6fd;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 12px;
        box-sizing: border-box;
    }

    .rows {
        list-style: none;
        margin: 0;
        padding: 0;
        width: min(420px, 100%);
        display: grid;
        gap: 8px;
    }

    :global(.row) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 48px;
        padding: 0 14px;
        border: 1px solid rgba(125, 211, 252, 0.35);
        background: #102332;
        color: #ecfeff;
        font-weight: 850;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .row-meta {
        color: #67e8f9;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 12px;
        font-weight: 700;
        text-transform: none;
        letter-spacing: 0;
    }

    .panel-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
    }

    .panel-controls .measure {
        margin-left: 6px;
    }

    .wait-track {
        align-items: flex-start;
        gap: 16px;
    }

    :global(.wait-parent) {
        display: inline-block;
        padding: 12px;
        border: 1px solid rgba(125, 211, 252, 0.45);
        background: #102332;
    }

    :global(.wait-parent.gated) {
        border-color: #f0abfc;
    }

    :global(.wait-child) {
        display: grid;
        place-items: center;
        background: #67e8f9;
        color: #031316;
        font-weight: 900;
    }

    :global(.wait-child.small) {
        width: 72px;
        height: 40px;
    }

    :global(.wait-child.large) {
        width: 160px;
        height: 96px;
    }

    :global(.orb) {
        width: 96px;
        height: 96px;
        display: grid;
        place-items: center;
        border-radius: 24px;
        color: #031316;
        font-size: 22px;
        font-weight: 900;
    }

    button {
        min-width: 96px;
        border: 1px solid rgba(125, 211, 252, 0.45);
        border-radius: 6px;
        background: #102332;
        color: #ecfeff;
        padding: 10px 14px;
        font: inherit;
        font-weight: 850;
        cursor: pointer;
    }

    button:hover {
        border-color: #67e8f9;
        background: #153247;
    }

    @media (max-width: 760px) {
        .grid {
            grid-template-columns: 1fr;
        }
    }
</style>
