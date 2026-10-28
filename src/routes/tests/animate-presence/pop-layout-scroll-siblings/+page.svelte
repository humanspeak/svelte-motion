<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, LayoutGroup, motion } from '$lib'
    import { onMount } from 'svelte'
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
     * the scroll (or resize) distance. And an exit clone has no projection
     * node, so it never followed the layout move its element would have
     * animated: when a clamp moves the content, siblings slide but the clone
     * jumped.
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

    let items = $state<Item[]>([0, 1, 2, 3, 4].map((id) => ({ id, present: true })))
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

    const scrollBottom = () => {
        if (fixed) {
            window.scrollTo(0, 300)
            return
        }
        const scroller = document.getElementById('scroller')!
        scroller.scrollTop = scroller.scrollHeight
    }

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { gap: number; jump: number }
    let isTester = $state(false)
    let verdict = $state<Verdict | null>(null)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const topOf = (id: number) =>
        document
            .querySelector<HTMLElement>(`[data-testid="sib-${id}"]:not([data-clone])`)
            ?.getBoundingClientRect().top
    const pinkTop = () =>
        document.querySelector<HTMLElement>('[data-testid="sib-2"]')?.getBoundingClientRect().top

    /**
     * Samples blue and pink every frame for a second after a removal: the
     * largest change of the pink−blue gap, and the largest step any of them
     * takes between two frames.
     */
    const watch = () => {
        if (!isTester) return
        const blue = topOf(1)
        const pink = pinkTop()
        if (blue === undefined || pink === undefined) return
        const startGap = pink - blue
        let previous: Record<'blue' | 'green', number | undefined> = { blue, green: topOf(3) }
        let gap = 0
        let jump = 0
        const start = performance.now()
        const sample = () => {
            const now = { blue: topOf(1), green: topOf(3) }
            const pinkNow = pinkTop()
            if (now.blue !== undefined && pinkNow !== undefined) {
                gap = Math.max(gap, Math.abs(pinkNow - now.blue - startGap))
            }
            for (const key of ['blue', 'green'] as const) {
                const a = previous[key]
                const b = now[key]
                if (a !== undefined && b !== undefined) jump = Math.max(jump, Math.abs(b - a))
            }
            previous = now
            if (performance.now() - start < 1000) {
                requestAnimationFrame(sample)
                return
            }
            verdict = { gap: Math.round(gap * 10) / 10, jump: Math.round(jump * 10) / 10 }
        }
        requestAnimationFrame(sample)
    }

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
        }
    ]
</script>

<svelte:head>
    <title>Layout siblings around exits in scroll containers (plan 015a)</title>
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
        <code>path={path} mode={mode}</code>
        {#if isTester && verdict}
            <span class="chip" class:bad={verdict.gap > 2}>
                {verdict.gap > 2 ? 'GAP DRIFTS' : 'GAP HOLDS'} · {verdict.gap}px
            </span>
            <span class="chip" class:bad={verdict.jump > 35}>
                {verdict.jump > 35 ? 'JUMPED' : 'NO JUMP'} · max step {verdict.jump}px
            </span>
        {/if}
    </div>

    {#if fixed}
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
    status="Expected on this build: GAP HOLDS and NO JUMP on ?path=clone (popLayout and ?mode=sync), ?fixed, ?sticky and after a resize."
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
</style>
