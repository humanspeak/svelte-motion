<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import { page } from '$app/state'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    /**
     * A `layout` element at rest keeps the browser's default
     * `transform-origin` (the centre), so a later `scale` shrinks towards its
     * centre, and it gets no `will-change: transform`.
     *
     * Upstream (Motion 14.7.1) has one layout writer of `transform-origin`:
     * `applyProjectionStyles` in
     * `packages/motion-dom/src/projection/node/create-projection-node.ts:2119`,
     * which writes `${x.origin * 100}% ${y.origin * 100}% 0` (default
     * `50% 50% 0`) only while it projects a layout delta. Nothing writes
     * `will-change` for layout.
     *
     * Four fixtures:
     * - **fresh**: a `layout` box that never had a layout change scales to 0.4.
     * - **settled**: a `layout` box moves across its track (a layout
     *   animation), then scales to 0.4.
     * - **pop**: a `layout` item exits from `AnimatePresence mode="popLayout"`
     *   with `scale: 0.4`. `?path=owned` (default) uses the `present` +
     *   `child` snippet form, `?path=clone` the `{#if}` form.
     * - **fixed-child**: a `position: fixed` child of a `layout` element must
     *   sit in the window's top-left corner. `will-change: transform` on the
     *   host would make the host its containing block.
     *
     * The `data-testid`s are what `e2e/layout/transform-origin-at-rest.spec.ts`
     * drives; keep them stable.
     */
    type Fixture = 'fresh' | 'settled' | 'pop'

    const transition = { duration: 0.8, ease: 'linear' } as const
    const path = $derived(page.url.searchParams.get('path') === 'clone' ? 'clone' : 'owned')

    let freshScaled = $state(false)
    let settledEnd = $state(false)
    let settledScaled = $state(false)
    let showPop = $state(true)

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { drift: number; centred: boolean }
    let isTester = $state(false)
    let verdicts = $state<Partial<Record<Fixture, Verdict>>>({})
    let fixedVerdict = $state<{ left: number; top: number; viewport: boolean } | null>(null)

    const query = (selector: string) => document.querySelector<HTMLElement>(selector)

    const checkFixed = () => {
        if (!isTester) return
        const r = query('[data-testid="fixed-child"]')?.getBoundingClientRect()
        if (!r) return
        fixedVerdict = {
            left: Math.round(r.left),
            top: Math.round(r.top),
            viewport: Math.abs(r.left) <= 0.5 && Math.abs(r.top) <= 0.5
        }
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        requestAnimationFrame(checkFixed)
    })

    /**
     * Records the box's resting centre, then samples it every frame for
     * 900 ms and keeps the largest centre drift.
     *
     * @param fixture Which verdict chip to fill.
     * @param selector The element to sample (the clone, for a clone exit).
     * @param restSelector The element whose rect is the resting box.
     * @param act Performs the action (after the resting rect is read).
     */
    const watch = (fixture: Fixture, selector: string, restSelector: string, act: () => void) => {
        if (!isTester) {
            act()
            return
        }
        const rest = query(restSelector)?.getBoundingClientRect()
        act()
        if (!rest) return
        const cx = rest.left + rest.width / 2
        const cy = rest.top + rest.height / 2
        let drift = 0
        const start = performance.now()
        const sample = () => {
            const r = query(selector)?.getBoundingClientRect()
            if (r && r.width > 0) {
                drift = Math.max(
                    drift,
                    Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
                )
            }
            if (performance.now() - start < 900) {
                requestAnimationFrame(sample)
                return
            }
            const rounded = Math.round(drift)
            verdicts[fixture] = { drift: rounded, centred: rounded <= 1 }
        }
        requestAnimationFrame(sample)
    }

    const scaleFresh = () =>
        watch('fresh', '[data-testid="fresh-box"]', '[data-testid="fresh-box"]', () => {
            freshScaled = !freshScaled
        })

    const moveSettled = () => {
        settledEnd = !settledEnd
    }

    const scaleSettled = () =>
        watch('settled', '[data-testid="settled-box"]', '[data-testid="settled-box"]', () => {
            settledScaled = !settledScaled
        })

    const exitPop = () => {
        if (!showPop) return
        const selector =
            path === 'clone'
                ? '[data-testid="pop-box"][data-clone="true"]'
                : '[data-testid="pop-box"]'
        watch('pop', selector, '[data-testid="pop-box"]', () => {
            showPop = false
        })
    }

    const resetPop = () => {
        showPop = true
    }

    const steps: TesterStep[] = [
        {
            text: 'Scale the fresh box.',
            expected:
                'It shrinks towards its own centre, not into its top-left corner. The chip reads CENTRED · drift ≤ 1px.',
            action: { label: 'Scale', run: scaleFresh }
        },
        {
            text: 'Move the settled box, wait for it to arrive, then scale it.',
            expected:
                'It glides to the other end of its track, then shrinks towards its centre. The chip reads CENTRED · drift ≤ 1px.',
            action: {
                label: 'Move, then scale',
                run: () => {
                    moveSettled()
                    setTimeout(scaleSettled, 1200)
                }
            }
        },
        {
            text: 'Exit the pop box (press "Reset" in the page to bring it back).',
            expected:
                'It shrinks in place towards its centre while the grey sibling slides into its spot. The chip reads CENTRED.',
            action: { label: 'Exit', run: exitPop }
        },
        {
            text: 'Look at the red square.',
            expected:
                'It sits in the top-left corner of the window, not of the grey box. The chip reads VIEWPORT.',
            action: { label: 'Check', run: checkFixed }
        }
    ]
</script>

<svelte:head>
    <title>layout — transform-origin stays at the centre at rest</title>
</svelte:head>

{#snippet verdictChip(fixture: Fixture)}
    {#if isTester && verdicts[fixture]}
        <span class="verdict" class:ok={verdicts[fixture]!.centred}>
            {verdicts[fixture]!.centred ? 'CENTRED' : 'CORNER'} · drift {verdicts[fixture]!.drift}px
        </span>
    {/if}
{/snippet}

<main class="page">
    <header>
        <p class="kicker">layout · Motion 14.7.1 parity</p>
        <h1>A layout element at rest keeps its centre origin.</h1>
        <p class="lede">
            Every box below has <code>layout</code>. Motion leaves <code>transform-origin</code>
            alone until the projection animates a layout change, so a later <code>scale</code>
            pivots on the box's centre, and it writes no <code>will-change</code>.
        </p>
    </header>

    <section class="card">
        <h2>fresh {@render verdictChip('fresh')}</h2>
        <p class="lede">
            Never moved. <code>animate={'{{ scale }}'}</code> toggles between 1 and 0.4.
        </p>
        <div class="stage">
            <motion.div
                layout
                data-testid="fresh-box"
                class="box"
                animate={{ scale: freshScaled ? 0.4 : 1 }}
                {transition}
            >
                fresh
            </motion.div>
        </div>
        <button type="button" data-testid="scale-fresh" onclick={scaleFresh}>Scale</button>
    </section>

    <section class="card">
        <h2>settled {@render verdictChip('settled')}</h2>
        <p class="lede">Move it first (a layout animation across the track), then scale it.</p>
        <div class="track" style:justify-content={settledEnd ? 'flex-end' : 'flex-start'}>
            <motion.div
                layout
                data-testid="settled-box"
                class="box"
                animate={{ scale: settledScaled ? 0.4 : 1 }}
                {transition}
            >
                settled
            </motion.div>
        </div>
        <div class="buttons">
            <button type="button" data-testid="move-settled" onclick={moveSettled}>Move</button>
            <button type="button" data-testid="scale-settled" onclick={scaleSettled}>Scale</button>
        </div>
    </section>

    <section class="card">
        <h2>pop ({path}) {@render verdictChip('pop')}</h2>
        <p class="lede">
            <code>AnimatePresence mode="popLayout"</code>; the item exits with
            <code>scale: 0.4</code>. Switch form with <code>?path=owned</code> or
            <code>?path=clone</code>.
        </p>
        <div class="row">
            {#if path === 'clone'}
                <AnimatePresence mode="popLayout">
                    {#if showPop}
                        <motion.div
                            key="pop"
                            layout
                            data-testid="pop-box"
                            class="box"
                            exit={{ scale: 0.4 }}
                            {transition}
                        >
                            pop
                        </motion.div>
                    {/if}
                </AnimatePresence>
            {:else}
                <AnimatePresence mode="popLayout" present={showPop}>
                    {#snippet child()}
                        <motion.div
                            layout
                            data-testid="pop-box"
                            class="box"
                            exit={{ scale: 0.4 }}
                            {transition}
                        >
                            pop
                        </motion.div>
                    {/snippet}
                </AnimatePresence>
            {/if}
            <div class="sibling" data-testid="pop-sibling">sibling</div>
        </div>
        <div class="buttons">
            <button type="button" data-testid="exit-pop" onclick={exitPop}>Exit</button>
            <button type="button" data-testid="reset-pop" onclick={resetPop}>Reset</button>
        </div>
    </section>

    <section class="card">
        <h2>
            fixed-child
            {#if isTester && fixedVerdict}
                <span class="verdict" class:ok={fixedVerdict.viewport}>
                    {fixedVerdict.viewport ? 'VIEWPORT' : 'HOST'} · at ({fixedVerdict.left}, {fixedVerdict.top})
                </span>
            {/if}
        </h2>
        <p class="lede">
            The red square is <code>position: fixed; top: 0; left: 0</code> inside a
            <code>layout</code> element (grey). It belongs in the window's top-left corner.
        </p>
        <motion.div layout data-testid="fixed-host" class="host" style="margin: 40px; height: 80px">
            <div
                data-testid="fixed-child"
                class="fixed-child"
                style="position: fixed; top: 0; left: 0; width: 10px; height: 10px"
            ></div>
        </motion.div>
    </section>
</main>

<TesterPanel
    eyebrow="projection/node/create-projection-node.ts:2119 (Motion 14.7.1)"
    title="layout leaves transform-origin alone at rest"
    status="Expected on this build: fresh, settled and pop read CENTRED · drift ≤ 1px on both ?path=owned and ?path=clone, and the red square reads VIEWPORT · at (0, 0)."
    {steps}
>
    {#snippet checks()}
        <p>
            Motion's only layout writer of <code>transform-origin</code> is the projection, and only
            while it projects a layout delta (with the centre, <code>50% 50% 0</code>, as the
            default). A <code>layout</code> element at rest has no inline origin and no
            <code>will-change</code>, so a <code>scale</code> pivots on its centre and
            <code>position: fixed</code> children are positioned against the window.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    .kicker {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.6;
    }

    h1 {
        margin: 4px 0 8px;
        font-size: 24px;
    }

    .lede {
        max-width: 640px;
        opacity: 0.75;
    }

    .card {
        display: grid;
        gap: 16px;
        max-width: 680px;
        margin: 32px 0;
        padding: 24px;
        border-radius: 16px;
        background: #1a1d24;
    }

    h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 16px;
    }

    .stage {
        padding: 12px 0;
    }

    .track {
        display: flex;
        width: 600px;
        padding: 12px 0;
        border-radius: 12px;
        background: #11141a;
    }

    .row {
        position: relative;
        display: flex;
        gap: 8px;
    }

    :global(.box) {
        display: grid;
        place-items: center;
        width: 200px;
        height: 120px;
        border-radius: 12px;
        background: #6366f1;
        font-family: monospace;
    }

    .sibling {
        display: grid;
        place-items: center;
        width: 120px;
        height: 120px;
        border-radius: 12px;
        background: #4b5563;
        font-family: monospace;
    }

    :global(.host) {
        border-radius: 12px;
        background: #4b5563;
    }

    .fixed-child {
        background: #ef4444;
    }

    .buttons {
        display: flex;
        gap: 8px;
    }

    .verdict {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }

    button {
        justify-self: start;
        padding: 10px 18px;
        border: none;
        border-radius: 10px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
</style>
