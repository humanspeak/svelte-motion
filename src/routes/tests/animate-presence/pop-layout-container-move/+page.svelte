<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Issue #2348: popLayout position incorrectly calculated. Port of upstream
     * `dev/react/src/tests/issue-2348.tsx` @ v14.7.1 (commits c3ff0cd87,
     * a23416c64, 6a74c8e29, a85c162b5, 7e831103e, 967b05df7, 154234270).
     *
     * Reporter's sandbox (a fork of the official "AnimatePresence popLayout
     * mode" example) with toggles for `popLayout` and a `fixed` class on the
     * `ul`. With both on, an exiting item should shrink towards its own centre,
     * not drop.
     *
     * Query parameters, as upstream:
     * - `popLayout`, `fixed` preset the checkboxes.
     * - `anchor=top|bottom|center` positions the fixed `ul` offset from the
     *   top, in the bottom-right corner (toast list) or centred with a
     *   percentage transform.
     * - `anchorY=top|bottom` is passed to `AnimatePresence`.
     * - `scroll` puts a tall spacer above the list, so removing an item from
     *   the bottom of a scrolled page shrinks the document. `scroller` does the
     *   same inside a scrollable element, which `positioned` makes the list's
     *   offsetParent. `mirror` lists the items in the page as well, so on a
     *   scrolled page removing one also clamps the page's scroll.
     * - `scale` renders everything inside a `scale(0.5)` wrapper (also the
     *   containing block of the "fixed" list). `layoutScroll` marks the list as
     *   a scroll container for layout animations.
     *
     * Plus `path=owned|clone` (default `clone`): `clone` renders the items as
     * keyed children of one `AnimatePresence` (clone exits); `owned` gives each
     * item its own `<AnimatePresence present>` with a `child` snippet (the real
     * node exits). The clone path strips `id`, so everything is addressed by
     * `data-testid`. Driven by `e2e/animate-presence/pop-layout-container-move.spec.ts`.
     */
    type Anchor = 'top' | 'bottom' | 'center'
    type Item = { id: number; present: boolean }

    const params = page.url.searchParams
    const anchorParam = params.get('anchor')
    let anchor = $state<Anchor>(
        anchorParam === 'bottom' || anchorParam === 'center' ? anchorParam : 'top'
    )
    const anchorYParam = params.get('anchorY')
    const anchorY = anchorYParam === 'top' || anchorYParam === 'bottom' ? anchorYParam : undefined
    const path = params.get('path') === 'owned' ? 'owned' : 'clone'
    const scale = params.has('scale')
    const scroll = params.has('scroll')
    const scroller = params.has('scroller')
    const positioned = params.has('positioned')
    const mirror = params.has('mirror')
    const layoutScroll = params.has('layoutScroll')

    let count = 0
    let items = $state<Item[]>([{ id: 0, present: true }])
    let popLayout = $state(params.has('popLayout'))
    let isFixed = $state(params.has('fixed'))

    const presentItems = $derived(items.filter((item) => item.present))

    const add = () => {
        count++
        items = [...items, { id: count, present: true }]
    }

    /** Remove the first present item and add one, in one state update. */
    const cycle = () => {
        count++
        const first = presentItems[0]
        const next = path === 'owned' ? [...items] : items.filter((item) => item !== first)
        items = [
            ...next.map((item) => (item === first ? { ...item, present: false } : item)),
            { id: count, present: true }
        ]
    }

    const remove = (id: number) => {
        watch(id)
        items =
            path === 'owned'
                ? items.map((item) => (item.id === id ? { ...item, present: false } : item))
                : items.filter((item) => item.id !== id)
    }

    const drop = (id: number) => {
        items = items.filter((item) => item.id !== id || item.present)
    }

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let verdict = $state<{ id: number; drift: number } | null>(null)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const centre = (id: number) => {
        const element = document.querySelector<HTMLElement>(`[data-testid="item-${id}"]`)
        if (!element) return
        const box = element.getBoundingClientRect()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }

    /**
     * Samples the exiting item's centre every frame for 300 ms and records the
     * largest distance it strays from where it was. A scale exit keeps the box
     * centre fixed, so anything above a pixel is the item drifting.
     */
    const watch = (id: number) => {
        if (!isTester) return
        const before = centre(id)
        if (!before) return
        let drift = 0
        const start = performance.now()
        const sample = () => {
            const now = centre(id)
            if (now) drift = Math.max(drift, Math.hypot(now.x - before.x, now.y - before.y))
            if (performance.now() - start < 300) {
                requestAnimationFrame(sample)
                return
            }
            verdict = { id, drift: Math.round(drift * 10) / 10 }
        }
        requestAnimationFrame(sample)
    }

    const fill = () => {
        while (presentItems.length < 4) add()
    }

    const setScenario = (next: Anchor) => {
        popLayout = true
        isFixed = true
        anchor = next
        verdict = null
        fill()
    }

    const removeSecond = () => {
        const second = presentItems[1]
        if (second) remove(second.id)
    }

    const steps: TesterStep[] = [
        {
            text: 'Set up the toast list: popLayout on, fixed on, anchored to the bottom-right corner, four items.',
            expected: 'Four pink items stacked in the bottom-right corner of the window.',
            action: { label: 'Bottom-anchored', run: () => setScenario('bottom') }
        },
        {
            text: 'Remove the second item (or click it).',
            expected:
                'It shrinks and fades exactly where it was; the items below it close the gap. The chip reads HOLDS (drift ≤ 1px). Before the fix it dropped a whole row (about 70px).',
            action: { label: 'Remove second', run: removeSecond }
        },
        {
            text: 'Switch to the centred list (translate(-50%, -50%)).',
            expected: 'Four items centred in the window.',
            action: { label: 'Centred', run: () => setScenario('center') }
        },
        {
            text: 'Remove the second item again.',
            expected:
                'It shrinks in place. The chip reads HOLDS. Before the fix it dropped by half a row (about 35px).',
            action: { label: 'Remove second', run: removeSecond }
        }
    ]
</script>

<svelte:head>
    <title>AnimatePresence popLayout — popping moves the container (#2348)</title>
</svelte:head>

{#snippet item(id: number)}
    <motion.li
        key={String(id)}
        data-testid="item-{id}"
        layout
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring' }}
        onclick={() => remove(id)}
    />
{/snippet}

<div
    class="example issue-2348"
    style={scale
        ? 'position: relative; height: 1200px; transform: scale(0.5); transform-origin: 0 0'
        : undefined}
>
    <div class="controls">
        <label class="enable">
            <code>popLayout</code>
            <input
                id="pop-layout"
                data-testid="pop-layout"
                type="checkbox"
                bind:checked={popLayout}
            />
        </label>
        <label class="enable">
            <code>fixed</code>
            <input id="fixed" data-testid="fixed" type="checkbox" bind:checked={isFixed} />
        </label>
        <button id="add" data-testid="add" type="button" onclick={add}>Add item</button>
        <button id="cycle" data-testid="cycle" type="button" onclick={cycle}>
            Remove first, add item
        </button>
        <code class="path">path={path}</code>
        {#if isTester && verdict}
            <span class="verdict" class:ok={verdict.drift <= 1}>
                {verdict.drift <= 1 ? 'HOLDS' : 'DRIFTS'} · max drift {verdict.drift}px
            </span>
        {/if}
    </div>
    <div
        id="scroller"
        data-testid="scroller"
        style={scroller
            ? `height: 300px; overflow: auto;${positioned ? ' position: relative;' : ''}`
            : undefined}
    >
        {#if scroll || scroller}
            <div style="height: 2000px"></div>
        {/if}
        {#if mirror}
            {#each presentItems as mirrored (mirrored.id)}
                <div style="height: 70px"></div>
            {/each}
        {/if}
        <motion.ul class={isFixed ? `fixed anchor-${anchor}` : ''} {layoutScroll}>
            <!-- A boundary reads its mode once, so toggling popLayout remounts the list. -->
            {#key popLayout}
                {#if path === 'owned'}
                    {#each items as entry (entry.id)}
                        <AnimatePresence
                            present={entry.present}
                            mode={popLayout ? 'popLayout' : 'sync'}
                            {anchorY}
                            onExitComplete={() => drop(entry.id)}
                        >
                            {#snippet child()}
                                {@render item(entry.id)}
                            {/snippet}
                        </AnimatePresence>
                    {/each}
                {:else}
                    <AnimatePresence mode={popLayout ? 'popLayout' : 'sync'} {anchorY}>
                        {#each presentItems as entry (entry.id)}
                            {@render item(entry.id)}
                        {/each}
                    </AnimatePresence>
                {/if}
            {/key}
        </motion.ul>
    </div>
</div>

<TesterPanel
    eyebrow="AnimatePresence/PopChild.tsx (Motion 14.7.0, #2348)"
    title="popLayout exits stay put when the container moves"
    status="Expected on this build: both removals read HOLDS, on ?path=clone and ?path=owned."
    {steps}
>
    {#snippet checks()}
        <p>
            In <code>mode="popLayout"</code> an exiting item is pinned with
            <code>position: absolute</code> inside its container. Popping it out of the flow shrinks the
            container; a bottom-anchored or centred container then moves, and used to carry the exiting
            item with it. Now the item is measured again once the update is in the DOM and offset back,
            before the layout animations measure it.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /*
     * The test app centres every page (`#sandbox` is a centring flexbox), which
     * would make the "static" list a vertically centred one that moves when it
     * shrinks. Upstream's fixture sits in normal flow, so this page does too.
     */
    :global(.container:has(.issue-2348)),
    :global(#sandbox:has(.issue-2348)) {
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

    .example :global(ul) {
        display: flex;
        flex-direction: column;
        gap: 10px;
        list-style: none;
        margin: 0;
        padding: 0;
        width: 150px;
    }

    .example :global(li) {
        display: block;
        width: 150px;
        height: 60px;
        border-radius: 10px;
        background: #ff0088;
        cursor: pointer;
    }

    .example :global(ul.fixed.anchor-top) {
        position: fixed;
        top: 200px;
        left: 200px;
    }

    .example :global(ul.fixed.anchor-bottom) {
        position: fixed;
        bottom: 20px;
        right: 20px;
    }

    .example :global(ul.fixed.anchor-center) {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    .verdict {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        color: white;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }
</style>
