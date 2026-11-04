<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { tick } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * popLayout playground for #2348, modelled loosely on upstream
     * `dev/react/src/tests/pop-layout-playground.tsx` @ v14.7.1 (commit
     * 154234270): pick a preset, remove an item, and watch it against a dashed
     * ghost of where it was, with each removal's largest centre drift.
     *
     * `?preset=<id>` and `?path=owned|clone` preselect. The drift readouts are
     * plain DOM (`data-testid="drift-<id>"`) so the smoke e2e in
     * `e2e/animate-presence/pop-layout-container-move.spec.ts` can read them;
     * only the guide panel is hidden under `?@isPlaywright=true`.
     */
    type Anchor = 'static' | 'top' | 'bottom' | 'center'
    type Preset = {
        id: string
        label: string
        group: "Reporter's scenarios" | 'Harder scenarios' | 'Still wrong with the fix'
        anchor: Anchor
        anchorY?: 'top' | 'bottom'
        scroll?: boolean
        scroller?: boolean
        positioned?: boolean
        mirror?: boolean
        scale?: boolean
        layoutScroll?: boolean
        rotate?: boolean
        toast?: boolean
        rapid?: boolean
        nested?: boolean
        note?: string
    }

    const presets: Preset[] = [
        { id: 'static', label: 'Static list', group: "Reporter's scenarios", anchor: 'static' },
        {
            id: 'fixed-top',
            label: 'Fixed list, top-anchored',
            group: "Reporter's scenarios",
            anchor: 'top'
        },
        {
            id: 'fixed-bottom',
            label: 'Fixed list, bottom-anchored (toasts)',
            group: "Reporter's scenarios",
            anchor: 'bottom'
        },
        {
            id: 'fixed-bottom-anchor',
            label: 'Fixed list, bottom-anchored, anchorY="bottom"',
            group: "Reporter's scenarios",
            anchor: 'bottom',
            anchorY: 'bottom'
        },
        {
            id: 'fixed-center',
            label: 'Fixed list, centred with translate(-50%, -50%)',
            group: "Reporter's scenarios",
            anchor: 'center'
        },
        {
            id: 'toast',
            label: 'Toast queue (remove the oldest and add one, in one update)',
            group: 'Harder scenarios',
            anchor: 'bottom',
            toast: true,
            note: 'The oldest toast exits as a new one goes in, in one update. Its layout animation starts from where it was, so it shrinks in place on both paths.'
        },
        {
            id: 'scroll-mirror',
            label: 'Scrolled page that shrinks (scroll clamps)',
            group: 'Harder scenarios',
            anchor: 'static',
            scroll: true,
            mirror: true,
            note: 'Scroll to the bottom first: removing an item shrinks the page, which clamps its scroll position. The exiting item moves with the content, so it stays on its ghost (both measured in the page).'
        },
        {
            id: 'scroller',
            label: 'Scrollable element that shrinks',
            group: 'Harder scenarios',
            anchor: 'static',
            scroller: true,
            note: 'Scroll the box to the bottom first. Plan 015: the drift readout is not expected to hold here yet.'
        },
        {
            id: 'scroller-positioned',
            label: 'Positioned scrollable element that shrinks',
            group: 'Harder scenarios',
            anchor: 'static',
            scroller: true,
            positioned: true,
            note: 'Scroll the box to the bottom first. Plan 015: the drift readout is not expected to hold here yet.'
        },
        {
            id: 'scaled',
            label: 'Fixed list, bottom-anchored, in a scale(0.5) ancestor',
            group: 'Harder scenarios',
            anchor: 'bottom',
            scale: true
        },
        {
            id: 'layout-scroll',
            label: 'Fixed list with layoutScroll on a scrolled page',
            group: 'Harder scenarios',
            anchor: 'bottom',
            scroll: true,
            mirror: true,
            layoutScroll: true,
            note: 'Scroll to the bottom first.'
        },
        {
            id: 'rapid',
            label: 'Rapid removals',
            group: 'Still wrong with the fix',
            anchor: 'bottom',
            rapid: true,
            note: 'Known limitation (upstream too): each exit is corrected once, when it pops. Later removals move the list again and carry earlier exits with it.'
        },
        {
            id: 'rotated',
            label: 'Rotated ancestor',
            group: 'Still wrong with the fix',
            anchor: 'bottom',
            rotate: true,
            note: 'Known limitation (upstream too): the correction is a translation, so it cannot undo a move along a rotated axis exactly.'
        },
        {
            id: 'nested',
            label: 'Nested AnimatePresence with propagate',
            group: 'Still wrong with the fix',
            anchor: 'bottom',
            nested: true,
            note: 'Known limitation (upstream too): the group exits as a whole; the items inside it are not popped separately.'
        }
    ]
    const groups = [...new Set(presets.map((preset) => preset.group))]

    const params = page.url.searchParams
    let presetId = $state(
        presets.some((preset) => preset.id === params.get('preset'))
            ? params.get('preset')!
            : 'fixed-bottom'
    )
    let path = $state<'owned' | 'clone'>(params.get('path') === 'owned' ? 'owned' : 'clone')
    const preset = $derived(presets.find((candidate) => candidate.id === presetId)!)

    type Item = { id: number; present: boolean }
    let count = 3
    let items = $state<Item[]>([0, 1, 2, 3].map((id) => ({ id, present: true })))
    let groupShown = $state(true)
    const presentItems = $derived(items.filter((item) => item.present))

    type Layer = 'fixed' | 'doc' | 'scroller'
    type Ghost = { id: number; layer: Layer; x: number; y: number; width: number; height: number }
    let ghosts = $state<Ghost[]>([])

    // Ghost layers, as upstream: one fixed to the viewport, one in the
    // document, one inside the scrollable element.
    let fixedLayer = $state<HTMLElement>()
    let docLayer = $state<HTMLElement>()
    let scrollerLayer = $state<HTMLElement>()
    const layerName = $derived<Layer>(
        preset.anchor !== 'static' && !preset.scale && !preset.rotate
            ? 'fixed'
            : preset.scroller
              ? 'scroller'
              : 'doc'
    )
    const layerOf = (layer: Layer) =>
        ({ fixed: fixedLayer, doc: docLayer, scroller: scrollerLayer })[layer]

    /** Upstream `layerScale`: the layer's on-screen scale. */
    const layerScale = (layer: HTMLElement) => {
        const { width, height } = layer.getBoundingClientRect()
        return [width / layer.offsetWidth || 1, height / layer.offsetHeight || 1]
    }

    /** Upstream `rectIn`: the element's rect in a ghost layer's coordinate space. */
    const rectIn = (element: Element, layer: HTMLElement) => {
        const rect = element.getBoundingClientRect()
        const origin = layer.getBoundingClientRect()
        const [sx, sy] = layerScale(layer)
        return {
            x: (rect.left - origin.left) / sx,
            y: (rect.top - origin.top) / sy,
            width: rect.width / sx,
            height: rect.height / sy
        }
    }
    const centre = (rect: { x: number; y: number; width: number; height: number }) => [
        rect.x + rect.width / 2,
        rect.y + rect.height / 2
    ]
    let drifts = $state<Record<number, number>>({})

    const reset = () => {
        count = 3
        items = [0, 1, 2, 3].map((id) => ({ id, present: true }))
        groupShown = true
        ghosts = []
        drifts = {}
    }

    const select = (id: string) => {
        presetId = id
        reset()
    }

    const query = (id: number) =>
        document.querySelector<HTMLElement>(`[data-testid="pg-item-${id}"]`)

    /**
     * Leaves a dashed ghost where the item was and records the largest
     * distance its centre strays from the ghost's over the next 300 ms, both
     * in the ghost's own layer (upstream `recordGhost`), so an item that
     * correctly moves with its layer (a clamped scroll) reads as holding.
     */
    const watch = (id: number) => {
        const element = query(id)
        const layer = layerOf(layerName)
        if (!element || !layer) return
        const rect = rectIn(element, layer)
        const [cx, cy] = centre(rect)
        ghosts = [...ghosts.filter((ghost) => ghost.id !== id), { id, layer: layerName, ...rect }]
        let drift = 0
        const start = performance.now()
        const sample = () => {
            const current = query(id)
            if (current && layer.isConnected) {
                const [x, y] = centre(rectIn(current, layer))
                drift = Math.max(drift, Math.hypot(x - cx, y - cy))
            }
            if (performance.now() - start < 300) {
                requestAnimationFrame(sample)
                return
            }
            drifts = { ...drifts, [id]: Math.round(drift * 10) / 10 }
        }
        requestAnimationFrame(sample)
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

    const add = () => {
        count++
        items = [...items, { id: count, present: true }]
    }

    /** Remove the oldest and add one, in one update. */
    const cycle = () => {
        const first = presentItems[0]
        if (first) watch(first.id)
        count++
        const next =
            path === 'owned'
                ? items.map((item) => (item === first ? { ...item, present: false } : item))
                : items.filter((item) => item !== first)
        items = [...next, { id: count, present: true }]
    }

    const removeRapidly = async () => {
        for (const item of presentItems.slice(0, 3)) {
            remove(item.id)
            await tick()
            await new Promise((resolve) => setTimeout(resolve, 80))
        }
    }

    const removeSecond = () => {
        const second = presentItems[1]
        if (second) remove(second.id)
    }

    const steps: TesterStep[] = [
        {
            text: 'Pick "Fixed list, bottom-anchored (toasts)", then click the second item.',
            expected:
                'It shrinks and fades inside its dashed ghost; the items below close the gap. The chip reads HOLDS.',
            action: {
                label: 'Bottom-anchored, remove second',
                run: () => {
                    select('fixed-bottom')
                    void tick().then(removeSecond)
                }
            }
        },
        {
            text: 'Pick "Fixed list, centred", then click the second item.',
            expected: 'Same: it shrinks inside its ghost, and the chip reads HOLDS.',
            action: {
                label: 'Centred, remove second',
                run: () => {
                    select('fixed-center')
                    void tick().then(removeSecond)
                }
            }
        },
        {
            text: 'Pick "Toast queue" and press "Remove oldest, add one" a few times.',
            expected:
                'The oldest toast shrinks in place each time, and its chip reads HOLDS on both paths.',
            action: { label: 'Toast queue', run: () => select('toast') }
        },
        {
            text: 'Switch the path toggle between clone and owned and repeat any step.',
            expected:
                'Both paths behave the same, apart from the scrollable-element cases noted on the preset.'
        }
    ]

    const fixedClass = $derived(preset.anchor === 'static' ? '' : `fixed anchor-${preset.anchor}`)
    const wrapperStyle = $derived(
        [
            preset.scale
                ? 'position: relative; height: 1200px; transform: scale(0.5); transform-origin: 0 0;'
                : '',
            preset.rotate ? 'transform: rotate(8deg); transform-origin: 100% 100%;' : ''
        ].join(' ') || undefined
    )
</script>

<svelte:head>
    <title>AnimatePresence popLayout playground (#2348)</title>
</svelte:head>

{#snippet item(id: number)}
    <motion.li
        key={String(id)}
        data-testid="pg-item-{id}"
        layout
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring' }}
        onclick={() => remove(id)}
    >
        {id}
    </motion.li>
{/snippet}

{#snippet list()}
    {#if path === 'owned'}
        {#each items as entry (entry.id)}
            <AnimatePresence
                present={entry.present}
                mode="popLayout"
                anchorY={preset.anchorY}
                onExitComplete={() => drop(entry.id)}
            >
                {#snippet child()}
                    {@render item(entry.id)}
                {/snippet}
            </AnimatePresence>
        {/each}
    {:else}
        <AnimatePresence mode="popLayout" anchorY={preset.anchorY}>
            {#each presentItems as entry (entry.id)}
                {@render item(entry.id)}
            {/each}
        </AnimatePresence>
    {/if}
{/snippet}

<div class="playground">
    <div class="controls">
        <label>
            Preset
            <select
                data-testid="preset"
                value={presetId}
                onchange={(event) => select(event.currentTarget.value)}
            >
                {#each groups as group (group)}
                    <optgroup label={group}>
                        {#each presets.filter((candidate) => candidate.group === group) as option (option.id)}
                            <option value={option.id}>{option.label}</option>
                        {/each}
                    </optgroup>
                {/each}
            </select>
        </label>
        <label>
            Path
            <select
                data-testid="path"
                value={path}
                onchange={(event) => {
                    path = event.currentTarget.value === 'owned' ? 'owned' : 'clone'
                    reset()
                }}
            >
                <option value="clone">clone (keyed children)</option>
                <option value="owned">owned (present + child)</option>
            </select>
        </label>
        <button type="button" data-testid="pg-add" onclick={add}>Add item</button>
        {#if preset.toast}
            <button type="button" data-testid="pg-cycle" onclick={cycle}>
                Remove oldest, add one
            </button>
        {/if}
        {#if preset.rapid}
            <button type="button" data-testid="pg-rapid" onclick={removeRapidly}>
                Remove three, 80 ms apart
            </button>
        {/if}
        {#if preset.nested}
            <button type="button" data-testid="pg-group" onclick={() => (groupShown = !groupShown)}>
                Toggle the group
            </button>
        {/if}
        <button type="button" data-testid="pg-reset" onclick={reset}>Reset</button>
    </div>
    {#if preset.note}
        <p class="note">{preset.note}</p>
    {/if}
    <ul class="drifts" data-testid="drifts">
        {#each Object.entries(drifts) as [id, drift] (id)}
            <li data-testid="drift-{id}" class:ok={drift <= 1}>
                item {id}: {drift <= 1 ? 'HOLDS' : 'DRIFTS'} · max centre drift {drift}px
            </li>
        {/each}
    </ul>

    {#key `${presetId}:${path}`}
        <div class="scene" style={wrapperStyle}>
            <div
                class="scroller"
                data-testid="pg-scroller"
                style={preset.scroller
                    ? `height: 300px; overflow: auto;${preset.positioned ? ' position: relative;' : ''}`
                    : undefined}
            >
                {#if preset.scroller}
                    <div class="ghost-layer-scroller" bind:this={scrollerLayer}>
                        {@render ghostLayer('scroller')}
                    </div>
                {/if}
                {#if preset.scroll || preset.scroller}
                    <div style="height: 2000px"></div>
                {/if}
                {#if preset.nested}
                    <motion.ul class={fixedClass}>
                        <AnimatePresence present={groupShown} mode="popLayout">
                            {#snippet child()}
                                <motion.div
                                    class="group"
                                    data-testid="pg-group-box"
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <AnimatePresence propagate mode="popLayout">
                                        {#each presentItems as entry (entry.id)}
                                            {@render item(entry.id)}
                                        {/each}
                                    </AnimatePresence>
                                </motion.div>
                            {/snippet}
                        </AnimatePresence>
                    </motion.ul>
                {:else}
                    <motion.ul class={fixedClass} layoutScroll={preset.layoutScroll}>
                        {@render list()}
                    </motion.ul>
                {/if}
                <!-- After the list, as upstream ({list}{mirror}). -->
                {#if preset.mirror}
                    {#each presentItems as mirrored (mirrored.id)}
                        <div style="height: 70px"></div>
                    {/each}
                {/if}
            </div>
        </div>
    {/key}

    <div class="ghost-layer-doc" bind:this={docLayer}>{@render ghostLayer('doc')}</div>
    <div class="ghost-layer-fixed" bind:this={fixedLayer}>{@render ghostLayer('fixed')}</div>
</div>

{#snippet ghostLayer(layer: Layer)}
    {#each ghosts.filter((ghost) => ghost.layer === layer) as ghost (ghost.id)}
        <div
            class="ghost"
            aria-hidden="true"
            style="left: {ghost.x}px; top: {ghost.y}px; width: {ghost.width}px; height: {ghost.height}px"
        ></div>
    {/each}
{/snippet}

<TesterPanel
    eyebrow="AnimatePresence/PopChild.tsx (Motion 14.7.0, #2348)"
    title="popLayout playground"
    status="Expected on this build: the reporter's scenarios and the toast queue read HOLDS on both paths. The scrollable-element presets don't hold yet (see their notes); the last group is wrong upstream too."
    {steps}
>
    {#snippet checks()}
        <p>
            Each removal leaves a dashed ghost where the item was and a readout of how far its
            centre strayed while it shrank. A scale exit keeps the centre still, so anything over a
            pixel is the item drifting with its container.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /* The test app centres every page; this one sits in normal flow. */
    :global(.container:has(.playground)),
    :global(#sandbox:has(.playground)) {
        display: block;
        min-height: 0;
    }

    .playground {
        padding: 16px;
        font-family: system-ui, sans-serif;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
    }

    .note {
        max-width: 640px;
        margin: 8px 0;
        font-size: 13px;
        opacity: 0.75;
    }

    .drifts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 8px 0 16px;
        padding: 0;
        list-style: none;
    }

    .drifts li {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        color: white;
        font-size: 12px;
        font-weight: 600;
    }

    .drifts li.ok {
        background: #14532d;
    }

    .scene :global(ul) {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 150px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .scene :global(li) {
        display: grid;
        place-items: center;
        width: 150px;
        height: 60px;
        border-radius: 10px;
        background: #ff0088;
        color: white;
        font-family: monospace;
        cursor: pointer;
        /* Plan 013: layout elements rest at transform-origin 0 0 (see the #2348 page). */
        transform-origin: 50% 50% !important;
    }

    .scene :global(.group) {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .scene :global(ul.fixed.anchor-top) {
        position: fixed;
        top: 200px;
        left: 200px;
    }

    .scene :global(ul.fixed.anchor-bottom) {
        position: fixed;
        right: 20px;
        bottom: 20px;
    }

    /* Keep the bottom-right list clear of the wide tester column (360px).
       The panel never renders under Playwright, so specs see upstream's 20px. */
    :global(body:has(.tester-panel:not(.narrow))) .scene :global(ul.fixed.anchor-bottom) {
        right: 380px;
    }

    .scene :global(ul.fixed.anchor-center) {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    /* Upstream `.pg-doc-layer`, `.pg-fixed-layer`, `.pg-scroller-layer`. */
    .ghost-layer-doc {
        position: absolute;
        top: 0;
        left: 0;
        width: 100px;
        height: 100px;
        pointer-events: none;
        z-index: 30;
    }

    .ghost-layer-fixed {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 30;
    }

    .ghost-layer-scroller {
        position: relative;
        height: 0;
    }

    .ghost {
        position: absolute;
        border: 2px dashed #ff0088;
        border-radius: 10px;
        pointer-events: none;
    }
</style>
