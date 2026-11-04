<script module lang="ts">
    import { HTMLProjectionNode } from 'motion-dom'

    /**
     * `?countReads` (plan 015b): count every projection read per element id,
     * in `window.__projectionReads`. Every adapter or projection read goes
     * through `measure` (`measurePageRect`, `updateLayout`, so
     * `refreshLayout`); 008's pop point cache doesn't. Wrapped here, at module
     * load, before any child mounts.
     */
    if (typeof window !== 'undefined' && window.location.search.includes('countReads')) {
        type Reads = Record<string, number>
        const w = window as unknown as { __projectionReads: Reads }
        w.__projectionReads = {}
        const proto = HTMLProjectionNode.prototype as unknown as {
            measure: (this: { instance?: Element }, ...args: unknown[]) => unknown
        }
        const measure = proto.measure
        proto.measure = function (this: { instance?: Element }, ...args: unknown[]) {
            const id = this.instance?.id
            if (id) w.__projectionReads[id] = (w.__projectionReads[id] ?? 0) + 1
            return measure.apply(this, args)
        }
    }
</script>

<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, LayoutGroup, motion } from '$lib'
    import { onMount, tick } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Layout siblings around an exit in a scrolled container (#2348, plan
     * 015a; 015b extends it).
     *
     * svelte-motion diffs observed layout changes against cached page-space
     * rects; upstream measures live in `willUpdate()`
     * (`create-projection-node.ts` @ v14.7.1: `measurePageBox` /
     * `removeElementScroll`, 1105-1156). A cached rect goes stale when a
     * scroller that isn't `layoutScroll` scrolls, when the page scrolls under a
     * fixed list, and when the window resizes (upstream re-measures after its
     * resize block, 511-532). Then removing an item made its siblings jump by
     * the scroll (or resize) distance. And the exit clone jumped when a clamp
     * moved the content, while its siblings slid. Since plan 012 the clone
     * keeps its element's projection node, so it follows the layout move as
     * upstream's exiting element does.
     *
     * Default layout: a 320px `#scroller` (`overflow: auto`) holding a 600px
     * spacer and a list of five `layout` items. Scroll it to the bottom and
     * remove the pink item: the list shrinks, so the scroll position clamps
     * (by 70px) and moves the content down. In a scroller that isn't
     * `layoutScroll`, every item animates from where it was on screen
     * (upstream `tests/react/issue-2348.spec.ts`), and the pink clone moves
     * with them.
     *
     * Query parameters:
     * - `path=owned|clone` (default `clone`): one `AnimatePresence` around the
     *   keyed items (exit clones), or one `<AnimatePresence present>` per item
     *   (the real node exits).
     * - `mode=popLayout|sync` (default `popLayout`).
     * - `layoutScroll`: the scroller is a `motion.div layoutScroll`, so a clamp
     *   is a one-frame content jump (no layout animation).
     * - `layoutGroup`: wraps the list in a `LayoutGroup`.
     * - `fixed`: no scroller; a 1500px page spacer, then the list as
     *   `position: fixed; bottom: 20px`.
     * - `sticky`: a `position: sticky` `layout` header as the first child of
     *   `#scroller`.
     * - `nolayout`: the items drop `layout`.
     * - `footer` (plan 015b): no scroller. A `layout` header (purple) in
     *   `#head-wrap`, the list, then a `layout` footer (orange) in
     *   `#foot-wrap`: outside the list's parent, so only part D reaches it.
     * - `followers=N`: N footers (`footer`, `footer-2`, …).
     * - `items=N`: the list length (1 or 2 keep pink, the item `Remove pink`
     *   removes).
     * - `countReads`: per-id projection reads in `window.__projectionReads`.
     *
     * `window.__removedAt` records when pink (or its clone) leaves the DOM.
     *
     * The exit fades with a 1.2s ease-in tween, so the pink item stays
     * detectable for many painted frames. Driven by
     * `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`.
     */
    type Item = { id: number; present: boolean }

    const params = page.url.searchParams
    const path = params.get('path') === 'owned' ? 'owned' : 'clone'
    const mode = params.get('mode') === 'sync' ? 'sync' : 'popLayout'
    const layoutScroll = params.has('layoutScroll')
    const layoutGroup = params.has('layoutGroup')
    const fixed = params.has('fixed')
    const sticky = params.has('sticky')
    const layout = !params.has('nolayout')
    const footer = params.has('footer')
    const followers = Math.max(1, Number(params.get('followers') ?? 1) || 1)
    const count = Math.min(5, Math.max(1, Number(params.get('items') ?? 5) || 5))
    const initialIds = count >= 3 ? [0, 1, 2, 3, 4].slice(0, count) : count === 2 ? [1, 2] : [2]

    let items = $state<Item[]>(initialIds.map((id) => ({ id, present: true })))
    const presentItems = $derived(items.filter((item) => item.present))

    const remove = (id = 2) => {
        watch()
        items =
            path === 'owned'
                ? items.map((item) => (item.id === id ? { ...item, present: false } : item))
                : items.filter((item) => item.id !== id)
    }
    const drop = (id: number) => {
        items = items.filter((item) => item.id !== id || item.present)
    }
    const add = () => {
        watch('add')
        const id = Math.max(-1, ...items.map((item) => item.id)) + 1
        items = [...items, { id, present: true }]
    }

    onMount(() => {
        // When pink (or its exit clone) leaves the DOM, for the read budgets.
        const w = window as unknown as { __removedAt?: number }
        const observer = new MutationObserver(() => {
            if (w.__removedAt !== undefined) return
            if (!document.querySelector('[data-testid="sib-2"]') && wasShown) {
                w.__removedAt = performance.now()
            }
        })
        let wasShown = !!document.querySelector('[data-testid="sib-2"]')
        observer.observe(document.body, { childList: true, subtree: true })
        return () => observer.disconnect()
    })

    const scrollBottom = () => {
        if (fixed) {
            window.scrollTo(0, 300)
            return
        }
        const scroller = document.getElementById('scroller')!
        scroller.scrollTop = scroller.scrollHeight
    }

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    /** `clamp`: the one-frame 70px content jump `?layoutScroll` expects (see `watch`). */
    type Verdict = { gap: number; jump: number; clamp: boolean }
    let isTester = $state(false)
    let verdict = $state<Verdict | null>(null)
    /** How the tracked sibling (the footer, or blue) reached its new place. */
    type Motion = { snapped: boolean; expected: boolean; step: number }
    let movement = $state<Motion | null>(null)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const topOf = (id: number) =>
        document
            .querySelector<HTMLElement>(`[data-testid="sib-${id}"]:not([data-clone])`)
            ?.getBoundingClientRect().top
    /** The painted pink: its exit clone while one exists, else the item. */
    const pinkTop = () =>
        (
            document.querySelector<HTMLElement>('[data-testid="sib-2"][data-clone]') ??
            document.querySelector<HTMLElement>('[data-testid="sib-2"]')
        )?.getBoundingClientRect().top
    /**
     * Start sampling after the update has flushed, so each frame's sample
     * runs after the frame callbacks the update scheduled (an exit clone's
     * first follow transform is written in one): a sample registered in the
     * click itself would read the clone a frame before it is drawn there.
     */
    const sampleFrames = (sample: FrameRequestCallback) => {
        void tick().then(() => requestAnimationFrame(sample))
    }

    /**
     * Samples blue and pink every frame for a second after a removal: the
     * largest change of the pink−blue gap, and the largest step any of them
     * takes between two frames.
     *
     * Under `?layoutScroll` the removal's clamp is a one-frame content jump,
     * as in Motion: in that one frame blue and pink (and green, which moves
     * with the content before it slides up) step by 70 ± 2px. That frame is
     * allowed once; every other step, green's slide included, still counts
     * against the 35px rule.
     */
    const watch = (action: 'remove' | 'add' = 'remove') => {
        if (!isTester) return
        watchMovement(action)
        const blue = topOf(1)
        const pink = pinkTop()
        if (blue === undefined || pink === undefined) return
        const startGap = pink - blue
        type Tops = Record<'blue' | 'pink' | 'green', number | undefined>
        let previous: Tops = { blue, pink, green: topOf(3) }
        let gap = 0
        let jump = 0
        let clamp = false
        const isClampStep = (step: number | undefined) =>
            step !== undefined && Math.abs(Math.abs(step) - 70) <= 2
        const start = performance.now()
        const sample = () => {
            const now: Tops = { blue: topOf(1), pink: pinkTop(), green: topOf(3) }
            if (now.blue !== undefined && now.pink !== undefined) {
                gap = Math.max(gap, Math.abs(now.pink - now.blue - startGap))
            }
            const frameSteps: Partial<Record<keyof Tops, number>> = {}
            for (const key of ['blue', 'pink', 'green'] as const) {
                const a = previous[key]
                const b = now[key]
                if (a !== undefined && b !== undefined) frameSteps[key] = b - a
            }
            const isClampFrame =
                layoutScroll &&
                action === 'remove' &&
                !clamp &&
                isClampStep(frameSteps.blue) &&
                isClampStep(frameSteps.pink)
            if (isClampFrame) {
                clamp = true
            } else {
                for (const key of ['blue', 'green'] as const) {
                    const step = frameSteps[key]
                    if (step !== undefined) jump = Math.max(jump, Math.abs(step))
                }
            }
            previous = now
            if (performance.now() - start < 1000) {
                requestAnimationFrame(sample)
                return
            }
            verdict = {
                gap: Math.round(gap * 10) / 10,
                jump: Math.round(jump * 10) / 10,
                clamp
            }
        }
        sampleFrames(sample)
    }

    /**
     * Samples the footer (or blue) every frame for 2.5s: a step of 50px or
     * more is a SNAP, a move made of smaller steps a SLIDE. A sync exit's
     * completion snaps everything outside its AnimatePresence (and outside
     * its LayoutGroup), as in Motion; everything else slides.
     */
    const watchMovement = (action: 'remove' | 'add') => {
        const tracked = () =>
            (footer ? document.getElementById('footer') : null)?.getBoundingClientRect().top ??
            topOf(1)
        let previous = tracked()
        let step = 0
        let moved = 0
        const start = performance.now()
        const sample = () => {
            const now = tracked()
            if (previous !== undefined && now !== undefined) {
                step = Math.max(step, Math.abs(now - previous))
                moved += Math.abs(now - previous)
            }
            previous = now
            if (performance.now() - start < 2500) {
                requestAnimationFrame(sample)
                return
            }
            if (moved < 20) return
            const snapped = step >= 50
            // A sync exit's completion snaps what is outside its
            // AnimatePresence and LayoutGroup: the footer, or blue on the
            // owned path (its own AnimatePresence); on the clone path blue
            // shares pink's AnimatePresence and slides. Under `?layoutScroll`
            // a removal's clamp is a one-frame content jump.
            const outsideBoundary = footer || path === 'owned'
            const expectSnap =
                action === 'remove' &&
                ((mode === 'sync' && !layoutGroup && outsideBoundary) || layoutScroll)
            movement = { snapped, expected: snapped === expectSnap, step: Math.round(step) }
        }
        sampleFrames(sample)
    }

    const variants = [
        { label: 'clone (default)', query: '' },
        { label: 'owned', query: 'path=owned' },
        { label: 'layoutScroll', query: 'layoutScroll' },
        { label: 'owned · layoutScroll', query: 'path=owned&layoutScroll' },
        { label: 'sticky', query: 'sticky' },
        { label: 'owned · sticky', query: 'path=owned&sticky' },
        { label: 'fixed', query: 'fixed' },
        { label: 'owned · fixed', query: 'path=owned&fixed' },
        { label: 'nolayout', query: 'nolayout' },
        { label: 'sync', query: 'mode=sync' },
        { label: 'owned · sync', query: 'mode=sync&path=owned' },
        { label: 'owned · sync · layoutGroup', query: 'mode=sync&path=owned&layoutGroup' },
        { label: 'footer', query: 'footer' },
        { label: 'footer · sync', query: 'footer&mode=sync' }
    ]
    /** The query in canonical form, to mark the open variant. */
    const canonical = (query: string) =>
        [...new URLSearchParams(query).entries()]
            .map(([k, v]) => (v ? `${k}=${v}` : k))
            .sort()
            .join('&')
    const currentQuery = canonical(page.url.search)

    const steps: TesterStep[] = [
        {
            text: 'Scroll the list to the bottom (on ?fixed, scroll the page by 300px).',
            expected: 'The blue, pink and green items are in view.',
            action: { label: 'Scroll to bottom', run: scrollBottom }
        },
        {
            text: 'Remove the pink item.',
            expected:
                'Nothing jumps. The scroll position clamps by 70px, and blue and pink glide down together while pink fades (GAP HOLDS, NO JUMP). With ?layoutScroll the content jumps by 70px in one frame instead, as in Motion. Before the fix the siblings jumped by the whole scroll distance.',
            action: { label: 'Remove pink', run: () => remove(2) }
        },
        {
            text: 'Reload, scroll to the bottom, resize the window (narrower), wait, then remove pink.',
            expected:
                'The items never slide sideways. Before the fix they slid by half the width change.'
        },
        {
            text: 'Plan 015b, ?path=owned (popLayout): scroll to the bottom and remove pink.',
            expected:
                'Blue glides down with the clamp and green holds (GAP HOLDS, NO JUMP), as on ?path=clone. Before the fix the owned siblings snapped by 70px. Same with ?fixed and ?sticky.'
        },
        {
            text: 'Plan 015b, ?mode=sync (no ?layoutGroup): remove pink and wait for the fade.',
            expected:
                'Siblings in other AnimatePresence boundaries (?path=owned) and the footer (?footer) JUMP into place when the fade ends: SNAP (expected), as in Motion, which re-renders only the AnimatePresence whose exit completed. Items in the same AnimatePresence (?path=clone) slide. With ?layoutGroup they slide: SLID (expected).',
            action: { label: 'Remove pink', run: () => remove(2) }
        },
        {
            text: 'Plan 015b, ?footer: remove pink, then add an item (popLayout, both paths).',
            expected:
                'The orange footer, outside the list, slides up 70px on the remove and down 70px on the add: SLID (expected). The purple header never moves. Before the fix the footer snapped.',
            action: { label: 'Add item', run: add }
        },
        {
            text: 'Plan 015b, ?footer&mode=sync: remove pink, wait for the fade to end, then add (also with &items=1).',
            expected:
                'The footer snaps up when the fade ends (SNAP (expected)), then slides down from where it now is on the add (SLID (expected)), with no jump back to its old place first.'
        }
    ]
</script>

<svelte:head>
    <title>Layout siblings around exits in scroll containers (plans 015a, 015b)</title>
</svelte:head>

{#snippet item(id: number)}
    <motion.li
        key={String(id)}
        id="sib-{id}"
        data-testid="sib-{id}"
        {layout}
        class="sib sib-{id}"
        transition={{ type: 'spring' }}
        exit={{ opacity: 0, transition: { type: 'tween', duration: 1.2, ease: 'easeIn' } }}
    />
{/snippet}

{#snippet entries()}
    {#if path === 'owned'}
        {#each items as entry (entry.id)}
            <AnimatePresence present={entry.present} {mode} onExitComplete={() => drop(entry.id)}>
                {#snippet child()}
                    {@render item(entry.id)}
                {/snippet}
            </AnimatePresence>
        {/each}
    {:else}
        <AnimatePresence {mode}>
            {#each presentItems as entry (entry.id)}
                {@render item(entry.id)}
            {/each}
        </AnimatePresence>
    {/if}
{/snippet}

{#snippet list()}
    <motion.ul id="list" data-testid="list" class={fixed ? 'fixed' : undefined}>
        {@render entries()}
    </motion.ul>
{/snippet}

{#snippet grouped()}
    {#if layoutGroup}
        <LayoutGroup>
            {@render list()}
        </LayoutGroup>
    {:else}
        {@render list()}
    {/if}
{/snippet}

{#snippet scrollerContent()}
    {#if sticky}
        <motion.div id="sticky-header" data-testid="sticky-header" class="sticky-header" layout />
    {/if}
    <div class="spacer"></div>
    {@render grouped()}
{/snippet}

<div class="example scroll-siblings">
    <div class="controls">
        <button id="scroll-bottom" data-testid="scroll-bottom" type="button" onclick={scrollBottom}>
            Scroll to bottom
        </button>
        <button id="remove" data-testid="remove" type="button" onclick={() => remove(2)}>
            Remove pink
        </button>
        <button id="add" data-testid="add" type="button" onclick={add}>Add item</button>
        <code>path={path} mode={mode}</code>
        {#if isTester && verdict}
            <span class="chip" class:bad={verdict.gap > 2}>
                {verdict.gap > 2 ? 'GAP DRIFTS' : 'GAP HOLDS'} · {verdict.gap}px
            </span>
            <span class="chip" class:bad={verdict.jump > 35}>
                {verdict.jump > 35
                    ? 'JUMPED'
                    : verdict.clamp
                      ? '70px one-frame step (expected)'
                      : 'NO JUMP'} · max step {verdict.jump}px
            </span>
        {/if}
        {#if isTester}
            <span class="variants">
                {#each variants as v (v.label)}
                    {#if canonical(v.query) === currentQuery}
                        <strong>{v.label}</strong>
                    {:else}
                        <a href="?{v.query}">{v.label}</a>
                    {/if}
                {/each}
            </span>
        {/if}
        {#if isTester && movement}
            <span class="chip" class:bad={!movement.expected}>
                {movement.snapped ? 'SNAP' : 'SLID'}{movement.expected
                    ? ' (expected)'
                    : ' (unexpected)'} · max step {movement.step}px
            </span>
        {/if}
    </div>

    {#if footer}
        {#snippet stage()}
            <div id="head-wrap" class="wrap">
                <motion.div id="header" data-testid="header" class="band header" layout />
            </div>
            {@render list()}
            <div id="foot-wrap" class="wrap">
                {#each Array.from({ length: followers }, (_, i) => i) as index (index)}
                    <motion.div
                        id={index === 0 ? 'footer' : `footer-${index + 1}`}
                        data-testid={index === 0 ? 'footer' : `footer-${index + 1}`}
                        class={index === 0 ? 'band footer' : 'band footer follower'}
                        layout
                        transition={{ type: 'spring' }}
                    />
                {/each}
            </div>
        {/snippet}
        <div id="stage" class="stage">
            {#if layoutGroup}
                <LayoutGroup>
                    {@render stage()}
                </LayoutGroup>
            {:else}
                {@render stage()}
            {/if}
        </div>
        <div class="page-spacer"></div>
    {:else if fixed}
        <div class="page-spacer"></div>
        {@render grouped()}
    {:else if layoutScroll}
        <motion.div id="scroller" data-testid="scroller" class="scroller" layoutScroll>
            {@render scrollerContent()}
        </motion.div>
    {:else}
        <div id="scroller" data-testid="scroller" class="scroller">
            {@render scrollerContent()}
        </div>
    {/if}
</div>

<TesterPanel
    eyebrow="create-projection-node.ts measurePageBox (Motion 14.7.1, #2348)"
    title="Layout siblings around exits in scroll containers"
    status="Expected on this build: GAP HOLDS and NO JUMP on both paths (popLayout), ?fixed, ?sticky and after a resize; on ?mode=sync without ?layoutGroup, owned siblings and the footer SNAP when the fade ends (as in Motion)."
    {steps}
>
    {#snippet checks()}
        <p>
            Cached layouts now account for scroll containers that aren't <code>layoutScroll</code>,
            fixed lists on a scrolled page, and window resizes, so removing an item after scrolling
            no longer makes its siblings jump by the scroll distance. A <code>layout</code> item's exit
            clone moves with the content when the removal clamps the scroll position, as in Motion.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /* The test app centres every page; this fixture sits in normal flow. */
    :global(.container:has(.scroll-siblings)),
    :global(#sandbox:has(.scroll-siblings)) {
        display: block;
        min-height: 0;
    }

    .example {
        padding: 16px;
        font-family: system-ui, sans-serif;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .example :global(.scroller) {
        position: relative;
        width: 200px;
        height: 320px;
        margin-inline: auto;
        overflow: auto;
        background: #fff;
        outline: 1px solid #ccc;
    }

    .spacer {
        height: 600px;
    }

    .page-spacer {
        height: 1500px;
    }

    .example :global(.sticky-header) {
        position: sticky;
        top: 0;
        z-index: 1;
        height: 40px;
        background: #222;
    }

    .example :global(ul) {
        display: flex;
        flex-direction: column;
        gap: 10px;
        list-style: none;
        margin: 0;
        padding: 0;
        width: 150px;
    }

    .example :global(ul.fixed) {
        position: fixed;
        bottom: 20px;
        left: calc(50% - 75px);
    }

    .example :global(li) {
        display: block;
        width: 150px;
        height: 60px;
        border-radius: 4px;
        background: #888;
    }

    /* Blue, pink (the one that exits) and green: the colours the spec tracks. */
    .example :global(li.sib-1) {
        background: #0077ff;
    }

    .example :global(li.sib-2) {
        background: #ff0088;
    }

    .example :global(li.sib-3) {
        background: #00aa44;
    }

    .stage {
        width: 150px;
        margin-inline: auto;
    }

    .wrap {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px 0;
    }

    .example :global(.band) {
        width: 150px;
        height: 40px;
        border-radius: 4px;
    }

    /* Purple header and orange footer: colours the spec tracks. */
    .example :global(.band.header) {
        background: #aa00ff;
    }

    /*
     * Taller than an item: items FLIP up over a footer that moved up under
     * them, and its bottom edge must stay in view.
     */
    .example :global(.band.footer) {
        height: 100px;
        background: #ffaa00;
    }

    .example :global(.band.footer.follower) {
        background: #885522;
    }

    .chip {
        padding: 2px 8px;
        border-radius: 999px;
        background: #0a7c2f;
        color: #fff;
        font-size: 12px;
    }

    .chip.bad {
        background: #b00020;
    }

    .variants {
        display: flex;
        flex-basis: 100%;
        flex-wrap: wrap;
        gap: 0.25rem 0.75rem;
        font-size: 0.8rem;
    }

    .variants a {
        color: #2563eb;
        text-decoration: underline;
    }
</style>
