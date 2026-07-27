<script lang="ts">
    /**
     * THROWAWAY SPIKE ROUTE — clone-exit-migration plan 001, Step 2
     * (Candidate B: data-driven children / list API). NOT product code.
     *
     * Left column of each row: the CANDIDATE — `SpikeAnimatePresenceList`
     * (`items` + `{#snippet child(item)}`) exiting REAL nodes through the
     * existing `PresenceChild` + `setActive('exit')` machinery.
     * Right column: TODAY'S markup — `<AnimatePresence>` + `{#each}` exiting via
     * the deep CLONE in `presence.ts` (clones carry `data-clone` attributes, so
     * the two are distinguishable from a test).
     *
     * Questions under test:
     *   (a) ergonomics vs today's markup, for sync / wait / popLayout;
     *   (b) does popLayout fall out of the existing machinery?
     *   (c) can the clone path and the list API coexist?
     *
     * ── MEASURED RESULTS (Chromium via Playwright, dev server) ────────────────
     *
     * PREREQUISITE FOUND (sections 5 + 6): a `motion.*` child of the SHIPPED
     * `PresenceChild` does NOT exit today. `present={false}` → the wrapper holds
     * the node forever (`opacity: 1`, never removed, 800ms window), with or
     * without a simultaneous motion-prop change. Cause: `updateFeatures()` —
     * the only thing that calls `ExitAnimationFeature.update()` (motion-dom
     * `VisualElement.mjs:317-345`; `update()` at `:370-393` does not) — runs only
     * in the container's mount effect (`_MotionContainer.svelte:2076`), and the
     * presence context is built inside `untrack()` (`:2123-2124`) so the flip
     * re-runs nothing. `SpikeExitProbe` emulates the missing two-line call.
     *
     * With that one gap emulated, everything else is EXISTING machinery:
     *   - sync (section 1): real node `b-item-a` animated `opacity` 0.73 → 0.24
     *     with NO `[data-clone]` anywhere, `onExitComplete` → `safeToRemove` at
     *     504ms for a 500ms exit (exact, unlike Candidate A), then the list
     *     dropped the entry (`list-dropped {rendered:"b,c"}`). Re-adding the key
     *     re-mounts and plays the enter (0.26 → 0.92).
     *   - wait (section 2): stage-0 exited (0.72 → 0.22) while stage-1 was held
     *     at `opacity: 0`; `item-exit-complete` at 408ms, then stage-1 entered
     *     (0.26 → 0.84 → 1.00) — PresenceChild's own wait accounting, no new
     *     coordination code. Deviation: the incoming node IS mounted (invisible)
     *     during the exit, so it occupies layout; upstream renders only exiting
     *     children in `wait` (AnimatePresence/index.tsx:179-235). The list owns
     *     the array, so a real implementation can withhold it.
     *   - popLayout (section 3): the REAL node went `position: absolute` via the
     *     existing exported helpers (`measurePopLayoutSnapshot` /
     *     `resolvePopLayoutStyles`) and the surviving siblings collapsed
     *     immediately (`pop-item-p2` x 713 → 627) — same visual result as the
     *     clone column, without placeholder or clone.
     *   - stateful content (section 7): clone canvas pixel read back
     *     `[0,0,0,0]` (bitmap lost by `cloneNode(true)`, `presence.ts:897`) and
     *     focus dropped to `<body>`; the real-node exit kept the painted pixel
     *     `[34,197,94,255]`, the live input value, AND keyboard focus
     *     (`document.activeElement` still the exiting `<input>` at
     *     `opacity: 0.36`).
     *   - SSR: `curl` of this route server-renders every list item and zero
     *     `data-clone` nodes.
     *   - coexistence: sections 1/3/7 run the list API and the clone path in the
     *     same document with no interference — the container only registers the
     *     clone path when `!inPresenceChild` (`_MotionContainer.svelte:652`), and
     *     both paths already share one `inFlightExits` counter
     *     (`presence.ts:622/668/691` vs `notifyExitStart/Complete`), so
     *     `mode='wait'` coordinates across a mixed tree.
     */
    import { AnimatePresence, PresenceChild, motion } from '$lib'
    import SpikeAnimatePresenceList from '../SpikeAnimatePresenceList.svelte'
    import { spikeLog } from '../spike-log'

    type Item = { id: string; label: string }
    const make = (ids: string[]): Item[] => ids.map((id) => ({ id, label: id.toUpperCase() }))

    let syncItems = $state<Item[]>(make(['a', 'b', 'c']))
    let cloneItems = $state<Item[]>(make(['a', 'b', 'c']))
    let waitStage = $state(0)
    let popItems = $state<Item[]>(make(['p1', 'p2', 'p3']))
    let popCloneItems = $state<Item[]>(make(['q1', 'q2', 'q3']))
    let controlVisible = $state(true)
    let control2Visible = $state(true)
    let control2Tick = $state(0)
    let statefulListItems = $state<Item[]>(make(['s1']))
    let statefulCloneItems = $state<Item[]>(make(['s2']))

    const statefulCard = `
        display: flex;
        gap: 6px;
        align-items: center;
        padding: 6px;
        border-radius: 8px;
        background: #111827;
    `

    /** Paint the canvas so a lost bitmap is detectable after a clone. */
    const paint = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#22c55e'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const getKey = (item: unknown) => (item as Item).id

    const pill = `
        width: 74px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #4f46e5;
        color: white;
        font: 700 13px/1 system-ui;
    `

    const remove = (which: string, fn: () => void) => {
        spikeLog('flip', { name: which })
        fn()
    }
</script>

<h1>SPIKE: Candidate B — data-driven children (<code>items</code> + snippet)</h1>
<p class="warn">Throwaway spike route (plan 001, clone-exit-migration). Nothing here ships.</p>

<section>
    <h2>1 — mode="sync": real-node exit (left) vs clone exit (right)</h2>
    <button
        data-testid="sync-remove"
        onclick={() => remove('sync', () => (syncItems = syncItems.slice(1)))}
    >
        list: remove first
    </button>
    <button
        data-testid="sync-reset"
        onclick={() => remove('sync-reset', () => (syncItems = make(['a', 'b', 'c'])))}
    >
        list: reset
    </button>
    <button
        data-testid="clone-remove"
        onclick={() => remove('clone', () => (cloneItems = cloneItems.slice(1)))}
    >
        clone: remove first
    </button>
    <button
        data-testid="clone-reset"
        onclick={() => remove('clone-reset', () => (cloneItems = make(['a', 'b', 'c'])))}
    >
        clone: reset
    </button>

    <div class="cols">
        <div class="col" data-testid="sync-list">
            <h3>Candidate B (real node)</h3>
            <div class="row">
                <SpikeAnimatePresenceList items={syncItems} {getKey} mode="sync">
                    {#snippet child(item)}
                        <motion.div
                            style={pill}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            transition={{ duration: 0.5 }}
                            data-testid={`b-item-${(item as Item).id}`}
                        >
                            {(item as Item).label}
                        </motion.div>
                    {/snippet}
                </SpikeAnimatePresenceList>
            </div>
        </div>

        <div class="col" data-testid="clone-list">
            <h3>Today (clone)</h3>
            <div class="row">
                <AnimatePresence mode="sync">
                    {#each cloneItems as item (item.id)}
                        <motion.div
                            key={item.id}
                            style={pill}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            transition={{ duration: 0.5 }}
                            data-testid={`clone-item-${item.id}`}
                        >
                            {item.label}
                        </motion.div>
                    {/each}
                </AnimatePresence>
            </div>
        </div>
    </div>
</section>

<section>
    <h2>2 — mode="wait": swap stage (enter must wait for the exit)</h2>
    <button data-testid="wait-next" onclick={() => remove('wait', () => (waitStage += 1))}>
        next stage
    </button>
    <div class="row" data-testid="wait-stage">
        <SpikeAnimatePresenceList
            items={[{ id: `stage-${waitStage}`, label: `S${waitStage}` }]}
            {getKey}
            mode="wait"
            onExitComplete={() => spikeLog('wait-onExitComplete')}
        >
            {#snippet child(item)}
                <motion.div
                    style={pill}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.4 }}
                    data-testid={`wait-item-${(item as Item).id}`}
                >
                    {(item as Item).label}
                </motion.div>
            {/snippet}
        </SpikeAnimatePresenceList>
    </div>
</section>

<section>
    <h2>3 — mode="popLayout": exiting node must leave layout flow</h2>
    <button
        data-testid="pop-remove"
        onclick={() =>
            remove('pop', () => (popItems = popItems.filter((item) => item.id !== 'p1')))}
    >
        list: remove first
    </button>
    <button
        data-testid="pop-reset"
        onclick={() => remove('pop-reset', () => (popItems = make(['p1', 'p2', 'p3'])))}
    >
        list: reset
    </button>
    <button
        data-testid="popclone-remove"
        onclick={() =>
            remove(
                'popclone',
                () => (popCloneItems = popCloneItems.filter((item) => item.id !== 'q1'))
            )}
    >
        clone: remove first
    </button>
    <button
        data-testid="popclone-reset"
        onclick={() => remove('popclone-reset', () => (popCloneItems = make(['q1', 'q2', 'q3'])))}
    >
        clone: reset
    </button>

    <div class="cols">
        <div class="col">
            <h3>Candidate B + popLayout on the real node</h3>
            <div class="row" data-testid="pop-row">
                <SpikeAnimatePresenceList items={popItems} {getKey} mode="popLayout" popLayout>
                    {#snippet child(item)}
                        <motion.div
                            style={pill}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            transition={{ duration: 0.6 }}
                            data-testid={`pop-item-${(item as Item).id}`}
                        >
                            {(item as Item).label}
                        </motion.div>
                    {/snippet}
                </SpikeAnimatePresenceList>
            </div>
        </div>
        <div class="col">
            <h3>Today (clone + placeholder)</h3>
            <div class="row" data-testid="popclone-row">
                <AnimatePresence mode="popLayout">
                    {#each popCloneItems as item (item.id)}
                        <motion.div
                            key={item.id}
                            style={pill}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            transition={{ duration: 0.6 }}
                            data-testid={`popclone-item-${item.id}`}
                        >
                            {item.label}
                        </motion.div>
                    {/each}
                </AnimatePresence>
            </div>
        </div>
    </div>
</section>

<section>
    <h2>5 — CONTROL: product <code>PresenceChild</code> + a <code>motion.*</code> child's exit</h2>
    <p>
        No spike wrapper at all — just the shipped components. Isolates whether the existing
        PresenceChild + <code>setActive('exit')</code> path drives a <code>motion.*</code> child's
        <code>exit</code> prop today.
    </p>
    <button
        data-testid="control-toggle"
        onclick={() => remove('control', () => (controlVisible = !controlVisible))}
    >
        toggle
    </button>
    <div class="row" data-testid="control-row">
        <AnimatePresence>
            <PresenceChild present={controlVisible}>
                <motion.div
                    style={pill}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.5 }}
                    data-testid="control-item"
                >
                    CTL
                </motion.div>
            </PresenceChild>
        </AnimatePresence>
    </div>
</section>

<section>
    <h2>6 — CONTROL 2: same as 5, but a motion prop also changes on the flip</h2>
    <p>
        Diagnostic for section 5's failure: <code
            >visualElement.update(next, buildPresenceContext())</code
        >
        runs inside <code>untrack()</code> (<code>_MotionContainer.svelte:2123-2124</code>), so the
        presence flip alone re-runs nothing. Bumping <code>custom</code> at the same time forces the update
        effect to re-run — if the exit animates here but not in section 5, the missing piece is exactly
        that dependency.
    </p>
    <button
        data-testid="control2-toggle"
        onclick={() =>
            remove('control2', () => {
                control2Visible = !control2Visible
                control2Tick += 1
            })}
    >
        toggle
    </button>
    <div class="row" data-testid="control2-row">
        <AnimatePresence>
            <PresenceChild present={control2Visible}>
                <motion.div
                    style={pill}
                    custom={control2Tick}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.5 }}
                    data-testid="control2-item"
                >
                    CTL2
                </motion.div>
            </PresenceChild>
        </AnimatePresence>
    </div>
</section>

<section>
    <h2>7 — stateful content: canvas bitmap + input value/focus during exit</h2>
    <p>
        The clone is built with <code>cloneNode(true)</code>
        (<code>presence.ts:897</code>), which copies markup but not canvas bitmaps, live input
        values, focus, or scroll positions. Real-node exits keep all of it.
    </p>
    <button
        data-testid="stateful-remove"
        onclick={() => remove('stateful', () => (statefulListItems = []))}
    >
        list: remove
    </button>
    <button
        data-testid="statefulclone-remove"
        onclick={() => remove('statefulclone', () => (statefulCloneItems = []))}
    >
        clone: remove
    </button>
    <button
        data-testid="stateful-reset"
        onclick={() =>
            remove('stateful-reset', () => {
                statefulListItems = make(['s1'])
                statefulCloneItems = make(['s2'])
            })}
    >
        reset
    </button>
    <div class="cols">
        <div class="col">
            <h3>Candidate B (real node)</h3>
            <div class="row">
                <SpikeAnimatePresenceList items={statefulListItems} {getKey}>
                    {#snippet child(item)}
                        <motion.div
                            style={statefulCard}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                            data-testid={`stateful-item-${(item as Item).id}`}
                        >
                            <canvas width="40" height="20" data-testid="stateful-canvas" use:paint
                            ></canvas>
                            <input data-testid="stateful-input" value="typed" />
                        </motion.div>
                    {/snippet}
                </SpikeAnimatePresenceList>
            </div>
        </div>
        <div class="col">
            <h3>Today (clone)</h3>
            <div class="row">
                <AnimatePresence>
                    {#each statefulCloneItems as item (item.id)}
                        <motion.div
                            key={item.id}
                            style={statefulCard}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                            data-testid={`statefulclone-item-${item.id}`}
                        >
                            <canvas
                                width="40"
                                height="20"
                                data-testid="statefulclone-canvas"
                                use:paint
                            ></canvas>
                            <input data-testid="statefulclone-input" value="typed" />
                        </motion.div>
                    {/each}
                </AnimatePresence>
            </div>
        </div>
    </div>
</section>

<section>
    <h2>4 — coexistence: both mechanisms under one page (question c)</h2>
    <p>
        Sections 1 and 3 already render the list API and the clone path side by side in the same
        document: the two never share a boundary, so nothing double-fires. What CANNOT coexist is
        both mechanisms on the SAME element — see the spike report.
    </p>
</section>

<style>
    :global(body) {
        font-family: system-ui;
        padding: 1.5rem;
    }
    section {
        margin-bottom: 2rem;
        border-top: 1px solid #ddd;
        padding-top: 0.75rem;
    }
    .cols {
        display: flex;
        gap: 2rem;
    }
    .col {
        flex: 1;
    }
    .row {
        display: flex;
        gap: 0.75rem;
        min-height: 60px;
        align-items: flex-start;
        margin-top: 0.5rem;
        position: relative;
    }
    h3 {
        font-size: 13px;
        margin: 0.75rem 0 0;
        color: #374151;
    }
    .warn {
        color: #b91c1c;
        font-weight: 600;
    }
    button {
        margin: 0 0.5rem 0.5rem 0;
    }
</style>
