<script lang="ts">
    /**
     * THROWAWAY SPIKE ROUTE — clone-exit-migration plan 001, Step 1
     * (Candidate A: Svelte `out:` transition bridge). NOT a product test page;
     * nothing here ships. Drive it manually or from a scratch Playwright run and
     * read `window.__spike.dump()`.
     *
     * Questions under test:
     *   (a) can a component attach an outro to its OWN root element from the
     *       inside? — every box below is a component that does exactly that
     *       (`SpikeExitBoxGlobal` / `SpikeExitBoxLocal`).
     *   (b) does the outro fire when a PARENT block is destroyed? — shapes 1-4
     *       compare `|global` vs local across nesting shapes.
     *   (c) can `onExitComplete` end the outro exactly? — shape 5 compares the
     *       three completion strategies.
     *   (bonus) shape 6: what `|global` does when an ANCESTOR of the whole
     *       presence boundary is torn down (upstream removes children instantly).
     *
     * ── MEASURED ANSWERS (Chromium via Playwright, svelte 5.56.4, dev server) ──
     *
     * (a) YES. The element is created by the component's own template, so an
     *     `out:` directive is ordinary template syntax — no compiler contract or
     *     `dispatchEvent` trickery needed. Shapes 1-8 all animate the REAL node
     *     (measured `opacity` 0.85 → 0.35 → 0.09 on `[data-spike-box]`, never a
     *     `[data-clone]`), and Svelte removes it only after the outro:
     *     `outroend` and `onDestroy` both land at ~402ms for a 400ms exit.
     *     Bonus: Svelte sets `element.inert = true` for the outro
     *     (transitions.js:270) — measured `inert: true` on every exiting box —
     *     which is strictly better a11y than the clone (no duplicated subtree in
     *     the a11y tree).
     *
     * (b) DEPENDS ON THE NESTING SHAPE, and neither modifier matches upstream:
     *       - shape 1 (component directly in the `{#if}`)      local ✅ global ✅
     *       - shape 2 (plain element between if and component) local ✅ global ✅
     *       - shape 3 (keyed `{#each}` item removed)           local ✅ global ✅
     *       - shape 8 (consumer component + snippet between)   local ✅ global ✅
     *       - shape 7 (NESTED `{#if}`, outer one flips)        local ❌ global ✅
     *     i.e. component and snippet boundaries are transparent
     *     (`EFFECT_TRANSPARENT`, effects.js:659-667) so a LOCAL outro survives
     *     them, but an intervening BLOCK effect (`{#if}`, `{#each}`, `{#key}`)
     *     sets `local = false` and the outro silently never runs: in shape 7
     *     `s7-local` stayed at `opacity: 1.00` and was destroyed with no
     *     `outrostart` at all. Meanwhile `|global` over-fires: shape 6 shows the
     *     ancestor's own removal delayed by the full 412ms exit, where upstream
     *     drops children instantly when the boundary unmounts.
     *
     * (c) ONLY BY REACHING INTO SVELTE'S RUNTIME. Measured in shape 5:
     *       - `fixed`          exit done 412ms, node removed 997ms → 585ms of an
     *                          invisible node holding layout. Unusable.
     *       - `duration-match` node removed 397ms, exit `finished` resolved
     *                          412ms → removal ~15ms EARLY, and it presumes the
     *                          exit duration is knowable up front (false for
     *                          interrupted or velocity-seeded springs).
     *       - `finish-hack`    exact: `finish()` on the WAAPI animation Svelte
     *                          created for the outro (found via
     *                          `element.getAnimations()`) at 413ms → `outroend`
     *                          430ms. Works, but depends on undocumented runtime
     *                          output (`transitions.js:465`
     *                          `element.animate(keyframes, {duration, fill})`)
     *                          — the plan's STOP condition: recorded as a
     *                          refutation, not a shipping mechanism.
     *
     * Two further measured costs of A:
     *   - PAUSED EFFECTS: `pause_effect` flips the subtree INERT (effects.js:609),
     *     so the exiting component's `$effect`s stop running for the whole exit
     *     (zero `effect-run` entries for `s1-global` between `outrostart` at 1ms
     *     and resume at 201ms, despite a 50ms interval mutating `$state`).
     *     Motion's rAF-driven animation still runs, but nothing that depends on
     *     `$effect` does — including `ve.update(props, presenceContext)`.
     *   - REVERSAL IS BROKEN: hiding then re-showing after 200ms leaves the real
     *     node resumed but stuck at the exit end state
     *     (`opacity: 0`, `transform: matrix(0.5,…)`, `inert: false`) with NO
     *     signal to the component: `in()` only aborts the outro
     *     (transitions.js:233-240), no `introstart` is dispatched, and no reactive
     *     dependency changed, so nothing re-runs the enter.
     */
    import SpikeExitBoxGlobal from '../SpikeExitBoxGlobal.svelte'
    import SpikeExitBoxLocal from '../SpikeExitBoxLocal.svelte'
    import SpikeConsumerWrapper from '../SpikeConsumerWrapper.svelte'
    import { spikeLog } from '../spike-log'
    import { spikeExit } from '../spikeExitTransition'

    let shape1 = $state(true)
    let shape2 = $state(true)
    let shape3 = $state(['a', 'b', 'c'])
    let shape4 = $state(true)
    let shape5 = $state({ fixed: true, match: true, hack: true })
    let shape6 = $state(true)
    let shape7 = $state(true)
    let shape8 = $state(true)
    const innerAlwaysTrue = true

    const flip = (name: string, fn: () => void) => {
        spikeLog('flip', { name })
        fn()
    }
</script>

<h1>SPIKE: Candidate A — Svelte <code>out:</code> transition bridge</h1>
<p class="warn">
    Throwaway spike route (plan 001, clone-exit-migration). Nothing here is product code.
</p>

<section>
    <h2>Shape 1 — component directly inside <code>{'{#if}'}</code></h2>
    <button data-testid="shape1-toggle" onclick={() => flip('shape1', () => (shape1 = !shape1))}>
        toggle
    </button>
    <div class="row">
        {#if shape1}
            <SpikeExitBoxGlobal id="s1-global" label="global" />
            <SpikeExitBoxLocal id="s1-local" label="local" />
        {/if}
    </div>
</section>

<section>
    <h2>Shape 2 — component nested under a plain element inside <code>{'{#if}'}</code></h2>
    <button data-testid="shape2-toggle" onclick={() => flip('shape2', () => (shape2 = !shape2))}>
        toggle
    </button>
    <div class="row">
        {#if shape2}
            <div class="wrap">
                <SpikeExitBoxGlobal id="s2-global" label="global" />
                <SpikeExitBoxLocal id="s2-local" label="local" />
            </div>
        {/if}
    </div>
</section>

<section>
    <h2>Shape 3 — keyed <code>{'{#each}'}</code> item removal</h2>
    <button
        data-testid="shape3-remove"
        onclick={() => flip('shape3', () => (shape3 = shape3.slice(1)))}
    >
        remove first
    </button>
    <button
        data-testid="shape3-reset"
        onclick={() => flip('shape3-reset', () => (shape3 = ['a', 'b', 'c']))}
    >
        reset
    </button>
    <div class="row">
        {#each shape3 as item (item)}
            <SpikeExitBoxGlobal id={`s3-global-${item}`} label={`global ${item}`} />
            <SpikeExitBoxLocal id={`s3-local-${item}`} label={`local ${item}`} />
        {/each}
    </div>
</section>

<section>
    <h2>Shape 4 — baseline: <code>out:</code> on an element in the SAME block</h2>
    <button data-testid="shape4-toggle" onclick={() => flip('shape4', () => (shape4 = !shape4))}>
        toggle
    </button>
    <div class="row">
        {#if shape4}
            <div
                class="spike-box baseline"
                data-spike-box="s4-inline-local"
                out:spikeExit={{ id: 's4-inline-local' }}
                onoutrostart={() => spikeLog('outrostart', { id: 's4-inline-local' })}
                onoutroend={() => spikeLog('outroend', { id: 's4-inline-local' })}
            >
                inline local
            </div>
        {/if}
    </div>
</section>

<section>
    <h2>Shape 5 — completion strategies (question c)</h2>
    <button
        data-testid="shape5-hide"
        onclick={() => flip('shape5', () => (shape5 = { fixed: false, match: false, hack: false }))}
    >
        hide all
    </button>
    <button
        data-testid="shape5-reset"
        onclick={() =>
            flip('shape5-reset', () => (shape5 = { fixed: true, match: true, hack: true }))}
    >
        reset
    </button>
    <div class="row">
        {#if shape5.fixed}
            <SpikeExitBoxGlobal
                id="s5-fixed"
                label="fixed 1000ms"
                params={{ strategy: 'fixed', duration: 0.4 }}
            />
        {/if}
        {#if shape5.match}
            <SpikeExitBoxGlobal
                id="s5-match"
                label="duration-match"
                params={{ strategy: 'duration-match', duration: 0.4 }}
            />
        {/if}
        {#if shape5.hack}
            <SpikeExitBoxGlobal
                id="s5-hack"
                label="finish-hack"
                params={{ strategy: 'finish-hack', duration: 0.4 }}
            />
        {/if}
    </div>
</section>

<section>
    <h2>Shape 6 — ancestor teardown (what <code>|global</code> costs)</h2>
    <p>
        Upstream <code>AnimatePresence</code> removes children instantly when the boundary itself
        unmounts. A <code>|global</code> outro instead delays the ancestor's removal.
    </p>
    <button data-testid="shape6-toggle" onclick={() => flip('shape6', () => (shape6 = !shape6))}>
        destroy ancestor
    </button>
    <div class="row" data-testid="shape6-host">
        {#if shape6}
            <div class="boundary" data-testid="shape6-boundary">
                <SpikeExitBoxGlobal id="s6-global" label="global (in torn-down boundary)" />
            </div>
        {/if}
    </div>
</section>

<section>
    <h2>Shape 7 — nested <code>{'{#if}'}</code>: the block that dies is an ANCESTOR block</h2>
    <p>
        Decisive locality case: dropping the OUTER <code>{'{#if}'}</code> makes the inner
        <code>{'{#if}'}</code> a non-transparent child block, so <code>pause_children</code>
        recurses with <code>local = false</code> (effects.js:667).
    </p>
    <button data-testid="shape7-toggle" onclick={() => flip('shape7', () => (shape7 = !shape7))}>
        toggle outer
    </button>
    <div class="row">
        {#if shape7}
            {#if innerAlwaysTrue}
                <SpikeExitBoxGlobal id="s7-global" label="global (nested if)" />
                <SpikeExitBoxLocal id="s7-local" label="local (nested if)" />
            {/if}
        {/if}
    </div>
</section>

<section>
    <h2>Shape 8 — extra consumer component + snippet boundary</h2>
    <button data-testid="shape8-toggle" onclick={() => flip('shape8', () => (shape8 = !shape8))}>
        toggle
    </button>
    <div class="row">
        {#if shape8}
            <SpikeConsumerWrapper>
                <SpikeExitBoxGlobal id="s8-global" label="global (in wrapper)" />
                <SpikeExitBoxLocal id="s8-local" label="local (in wrapper)" />
            </SpikeConsumerWrapper>
        {/if}
    </div>
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
    .row {
        display: flex;
        gap: 0.75rem;
        min-height: 60px;
        align-items: flex-start;
        margin-top: 0.5rem;
        position: relative;
    }
    .wrap,
    .boundary {
        display: flex;
        gap: 0.75rem;
        padding: 0.5rem;
        border: 1px dashed #bbb;
    }
    .spike-box.baseline {
        background: #b45309;
        color: white;
        padding: 1rem 1.25rem;
        border-radius: 0.5rem;
        font: 600 14px/1.2 system-ui;
    }
    .warn {
        color: #b91c1c;
        font-weight: 600;
    }
    button {
        margin-right: 0.5rem;
    }
</style>
