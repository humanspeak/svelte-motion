<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import { SvelteURLSearchParams } from 'svelte/reactivity'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Not a port: the nested `layoutId` pairs of upstream's
    // `dev/react/src/tests/layout-shared-lightbox-crossfade.tsx` @ v14.7.1, in
    // the clone syntax (a `motion.div` as the direct `AnimatePresence` child).
    // e2e/layout-id/nested-crossfade.spec.ts (plan 012, NC1-NC6).
    //
    // Upstream keeps every nested node of an exiting child mounted: each nested
    // `MeasureLayout` has its own `usePresence`, so the lightbox's dot relegates
    // and crossfades into the gallery dot, as the card does into the gallery
    // item.
    //
    // Variants:
    // - `?inner=boundary` wraps the lightbox's `#child` in a nested
    //   `<AnimatePresence>`: its child doesn't exit with the outer one, so it
    //   isn't relegated, and rides the outer card until it is released.
    // - `?inner=propagate` uses `<AnimatePresence propagate>`: its child exits
    //   with the outer one, so it relegates like `?inner` unset.
    // - `&innerExit=true` replaces the inner child with a plain `motion.div`
    //   `#fade` that has its own `exit` (1 s, linear).
    // - `&fast=true` makes the shared-layout transition 0.3 s.
    // - `?outer=plain` makes the lightbox a non-layout `motion.div` with
    //   `exit={{ opacity: 0 }}` (0.3 s).
    // The specs (`@isPlaywright=true`) use these durations. A human tester
    // gets every duration doubled, so each close can be watched, and a live
    // verdict for the current variant.
    // The nested boundary's `onExitComplete` counts into `#inner-done`.
    //
    // Every rAF, `window.nestedLog` records the clone copy of `#fade` (its
    // computed `opacity` and the scale of its computed `transform`), whether the
    // lightbox clone is connected, and `#inner-done`'s count.

    const params = page.url.searchParams
    const isPlaywright = params.get('@isPlaywright') === 'true'
    const inner = params.get('inner')
    const innerExit = params.get('innerExit') === 'true'
    const fast = params.get('fast') === 'true'
    const plainOuter = params.get('outer') === 'plain'

    const slow = isPlaywright ? 1 : 2
    const layoutDuration = (fast ? 0.3 : 1) * slow
    const fadeDuration = 1 * slow
    const plainDuration = 0.3 * slow
    const transition = { duration: layoutDuration, ease: 'linear' as const }
    const fadeTransition = { duration: fadeDuration, ease: 'linear' as const }
    const colors = ['tomato', 'royalblue', 'seagreen']

    let open = $state<string | false>(false)
    let shownColor = $state(colors[0])
    $effect.pre(() => {
        if (open !== false) shownColor = open
    })
    let innerDone = $state(0)
    // Set on mount, so the specs don't click before hydration.
    let hydrated = $state(false)

    type LogEntry = {
        t: number
        fadeOpacity: number | null
        fadeScale: number | null
        cloneConnected: boolean
        innerDone: number
    }
    onMount(() => {
        const w = window as unknown as { nestedLog: LogEntry[] }
        w.nestedLog = []
        hydrated = true
        let raf = 0
        const record = () => {
            const fade = document.querySelector<HTMLElement>('[data-clone] .fade')
            // Computed, not inline: Motion runs `opacity` and the transform
            // group on WAAPI, which the inline style doesn't show.
            const style = fade ? getComputedStyle(fade) : null
            const matrix = style?.transform.match(/^matrix\(([-\d.e]+)/)
            w.nestedLog.push({
                t: performance.timeOrigin + performance.now(),
                fadeOpacity: style ? Number(style.opacity) : null,
                fadeScale: style ? (matrix ? Number(matrix[1]) : 1) : null,
                cloneConnected: !!document.querySelector('[data-clone].lightbox'),
                innerDone
            })
            raf = requestAnimationFrame(record)
        }
        raf = requestAnimationFrame(record)
        return () => cancelAnimationFrame(raf)
    })

    // ---- Live verdict (tester only) ----
    //
    // The variant decides what a correct close looks like:
    // - relegate (default, inner=propagate): the card is held for the shared
    //   animation and its black dot stays centred on the gallery's white dot
    //   on every frame.
    // - boundary (inner=boundary): the dot isn't relegated, so it stays put
    //   at its own box while the card is held.
    // - fade (innerExit): the clone waits for the pink square's own exit,
    //   which fades it out, and the nested boundary's `onExitComplete` fires
    //   once.
    const mode: 'relegate' | 'boundary' | 'fade' = innerExit
        ? 'fade'
        : inner === 'boundary'
          ? 'boundary'
          : 'relegate'
    const holdFor = mode === 'fade' ? fadeDuration : layoutDuration
    type Verdict = 'waiting' | 'watching' | 'ok' | 'early' | 'off' | 'moved' | 'nofade' | 'done'
    let verdict = $state<Verdict>('waiting')
    let readout = $state<string | null>(null)
    onMount(() => {
        if (isPlaywright) return
        let wasOpen = open !== false
        let closedAt: number | null = null
        let worst = 0
        let firstDot: DOMRect | null = null
        let minOpacity = 1
        let doneAtClose = 0
        let raf = 0
        const centreGap = (a: DOMRect, b: DOMRect) =>
            Math.hypot(
                a.left + a.width / 2 - (b.left + b.width / 2),
                a.top + a.height / 2 - (b.top + b.height / 2)
            )
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            const isOpen = open !== false
            if (wasOpen && !isOpen) {
                closedAt = now
                worst = 0
                firstDot = null
                minOpacity = 1
                doneAtClose = innerDone
                verdict = 'watching'
                readout = null
            }
            if (!wasOpen && isOpen && closedAt !== null) {
                closedAt = null
                verdict = 'waiting'
                readout = 'opened again while closing (not judged)'
            }
            wasOpen = isOpen
            if (closedAt === null) return
            const elapsed = (now - closedAt) / 1000
            const clone = document.querySelector('[data-clone].lightbox')
            if (clone) {
                const dot = document.querySelector('[data-clone] #child')?.getBoundingClientRect()
                const itemDot = document.getElementById('item-child')?.getBoundingClientRect()
                if (mode === 'relegate' && dot && itemDot)
                    worst = Math.max(worst, centreGap(dot, itemDot))
                if (mode === 'boundary' && dot) {
                    firstDot ??= dot
                    worst = Math.max(
                        worst,
                        Math.abs(dot.left - firstDot.left),
                        Math.abs(dot.top - firstDot.top),
                        Math.abs(dot.width - firstDot.width)
                    )
                }
                const fade = document.querySelector<HTMLElement>('[data-clone] .fade')
                if (fade) minOpacity = Math.min(minOpacity, Number(getComputedStyle(fade).opacity))
                readout = `card held ${elapsed.toFixed(2)} s…`
                return
            }
            // Wait a frame after the clone goes, before reading the count.
            if (document.querySelector('.lightbox')) return
            const held = `held ${elapsed.toFixed(2)} s`
            if (elapsed < holdFor * 0.9) {
                verdict = 'early'
                readout = `card removed after ${elapsed.toFixed(2)} s, before ${holdFor} s`
            } else if (mode === 'relegate' && worst > 2) {
                verdict = 'off'
                readout = `${held}, dot up to ${worst.toFixed(1)} px off the white dot`
            } else if (mode === 'boundary' && worst > 1) {
                verdict = 'moved'
                readout = `${held}, dot moved ${worst.toFixed(1)} px`
            } else if (mode === 'fade' && minOpacity > 0.2) {
                verdict = 'nofade'
                readout = `${held}, square only faded to ${minOpacity.toFixed(2)}`
            } else if (mode === 'fade' && innerDone - doneAtClose !== 1) {
                verdict = 'done'
                readout = `${held}, onExitComplete fired ${innerDone - doneAtClose}×`
            } else {
                verdict = 'ok'
                readout =
                    mode === 'relegate'
                        ? `${held}, dot within ${worst.toFixed(1)} px`
                        : mode === 'boundary'
                          ? `${held}, dot stayed put`
                          : `${held}, square faded out`
            }
            closedAt = null
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const variants = [
        { label: 'default', query: '' },
        { label: 'inner=boundary', query: 'inner=boundary' },
        { label: 'inner=propagate', query: 'inner=propagate' },
        { label: 'propagate + fade', query: 'inner=propagate&innerExit=true&fast=true' },
        { label: 'plain outer + fade', query: 'outer=plain&inner=propagate&innerExit=true' }
    ]
    const keep = isPlaywright ? '@isPlaywright=true' : ''
    const variantHref = (query: string) => `?${[keep, query].filter(Boolean).join('&')}`
    // The variant this URL shows, whatever the order of its params.
    const canonical = (search: SvelteURLSearchParams) => {
        search.delete('@isPlaywright')
        return [...search]
            .map(([k, v]) => `${k}=${v}`)
            .sort()
            .join('&')
    }
    const current = variants.find(
        (v) =>
            canonical(new SvelteURLSearchParams(v.query)) ===
            canonical(new SvelteURLSearchParams(params))
    )?.label

    const closeExpected = plainOuter
        ? `The white card has no layoutId, so it just fades out, with the pink square inside it, in ${plainDuration} s. The invisible card stays mounted until the square's own ${fadeDuration} s exit ends. You can't see that part: the chip reads WAITED ✓ after about ${fadeDuration} s.`
        : mode === 'fade'
          ? `The card shrinks back into the red item and fades out in ${layoutDuration} s, with the pink square inside it. The invisible card stays mounted until the square's own ${fadeDuration} s exit ends. You can't see that part: the chip reads WAITED ✓ after about ${fadeDuration} s.`
          : mode === 'boundary'
            ? `The card shrinks back into the red item while it fades, but the black dot stays where it was, at full size: a nested AnimatePresence keeps it out of the exit. The item's white dot is hidden meanwhile. When the card is gone, the white dot grows back out of the black dot's last box. The chip reads DOT STAYED ✓.`
            : `The card shrinks back into the red item while it fades, and its black dot shrinks into the item's white dot, centred on it the whole way. The chip reads HELD ✓.`

    const steps: TesterStep[] = [
        {
            text: 'Click the red (tomato) gallery item.',
            expected:
                mode === 'fade'
                    ? `The white card grows out of the red item over ${layoutDuration} s, with a pink square in its middle.`
                    : plainOuter
                      ? 'The white card appears at once, with a pink square in its middle.'
                      : `Over ${layoutDuration} s the white card grows out of the red item, and its black dot grows out of the item's white dot.`,
            action: { label: 'Open red', run: () => (open = colors[0]) }
        },
        {
            text: 'Click "close" (bottom left), or the button here.',
            expected: closeExpected,
            action: { label: 'Close', run: () => (open = false) }
        },
        {
            text: 'Switch to the next variant with the links next to the chip, and repeat steps 1 and 2.',
            expected:
                'Each variant has its own expected close in step 2. Do all five: default, inner=boundary, inner=propagate (looks like default), propagate + fade, plain outer + fade.'
        }
    ]
</script>

<svelte:head>
    <title>layoutId · nested shared children of an exiting direct child</title>
</svelte:head>

{#snippet innerChild()}
    {#if innerExit}
        <motion.div
            key="fade"
            id="fade"
            class="fade"
            exit={{ opacity: 0, scale: 0.5 }}
            transition={fadeTransition}
        />
    {:else}
        <motion.div
            key="child"
            id="child"
            class="lightbox-child"
            layoutId="child-{shownColor}"
            {transition}
        />
    {/if}
{/snippet}

<div class="stage" data-hydrated={hydrated || undefined}>
    <ul class="gallery">
        {#each colors as color, i (color)}
            <motion.li
                class="item"
                style="background: {color};"
                layoutId={color}
                {transition}
                id={i === 0 ? 'item-parent' : undefined}
                onclick={() => (open = color)}
            >
                <motion.div
                    class="item-child"
                    id={i === 0 ? 'item-child' : undefined}
                    layoutId="child-{color}"
                    {transition}
                />
            </motion.li>
        {/each}
    </ul>
    <AnimatePresence>
        {#if open}
            {#if plainOuter}
                <motion.div
                    key="lightbox"
                    id="parent"
                    class="lightbox"
                    exit={{ opacity: 0 }}
                    transition={{ duration: plainDuration }}
                >
                    {#if inner}
                        <AnimatePresence
                            propagate={inner === 'propagate'}
                            onExitComplete={() => (innerDone += 1)}
                        >
                            {@render innerChild()}
                        </AnimatePresence>
                    {:else}
                        {@render innerChild()}
                    {/if}
                </motion.div>
            {:else}
                <motion.div
                    key="lightbox"
                    id="parent"
                    class="lightbox"
                    layoutId={shownColor}
                    {transition}
                >
                    {#if inner}
                        <AnimatePresence
                            propagate={inner === 'propagate'}
                            onExitComplete={() => (innerDone += 1)}
                        >
                            {@render innerChild()}
                        </AnimatePresence>
                    {:else}
                        <motion.div
                            id="child"
                            class="lightbox-child"
                            layoutId="child-{shownColor}"
                            {transition}
                        />
                    {/if}
                </motion.div>
            {/if}
        {/if}
    </AnimatePresence>
    <button id="close" type="button" onclick={() => (open = false)}>close</button>
    <span id="inner-done">{innerDone}</span>
</div>

<TesterPanel
    eyebrow="Plan 012 · nested layoutId on the clone path"
    title="Nested shared children of an exiting direct child"
    status="Plan 012: nested nodes of a direct AnimatePresence child relegate and hold, as upstream."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict === 'ok'
                ? 'ok'
                : verdict === 'waiting' || verdict === 'watching'
                  ? 'na'
                  : 'bad'}"
        >
            {verdict === 'ok'
                ? mode === 'fade'
                    ? 'WAITED ✓'
                    : mode === 'boundary'
                      ? 'DOT STAYED ✓'
                      : 'HELD ✓'
                : verdict === 'early'
                  ? 'REMOVED EARLY ✗'
                  : verdict === 'off'
                    ? 'DOT OFF ✗'
                    : verdict === 'moved'
                      ? 'DOT MOVED ✗'
                      : verdict === 'nofade'
                        ? 'NO FADE ✗'
                        : verdict === 'done'
                          ? 'EXIT COUNT ✗'
                          : verdict === 'watching'
                            ? 'WATCHING'
                            : 'WAITING'}
        </span>
        {#if readout}<span class="readout">{readout}</span>{/if}
        <span class="variants">
            {#each variants as v (v.label)}
                {#if v.label === current}
                    <strong>{v.label}</strong>
                {:else}
                    <a href={variantHref(v.query)}>{v.label}</a>
                {/if}
            {/each}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            The lightbox is a direct <code>motion.div</code> child of <code>AnimatePresence</code>,
            so it exits as a clone. Its nested <code>layoutId</code> dot moves to the clone with its projection
            node, relegates and crossfades into the gallery dot.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .verdict {
        display: inline-block;
        margin-right: 0.25rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
    .readout {
        font-size: 0.75rem;
        color: #475569;
    }
    .variants {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.75rem;
        margin-top: 0.5rem;
        font-size: 0.8rem;
    }
    .variants a {
        color: #2563eb;
        text-decoration: underline;
    }
    .stage {
        position: fixed;
        inset: 0;
        background: #f4f4f4;
    }
    .gallery {
        position: absolute;
        top: 40px;
        left: 40px;
        display: flex;
        gap: 20px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .stage :global(.item) {
        width: 120px;
        height: 120px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
    }
    .stage :global(.item-child) {
        width: 50px;
        height: 50px;
        background: white;
    }
    .stage :global(.lightbox) {
        position: absolute;
        top: 240px;
        left: 300px;
        width: 500px;
        height: 340px;
        background: white;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .stage :global(.lightbox-child) {
        width: 150px;
        height: 150px;
        background: black;
    }
    .stage :global(.fade) {
        width: 150px;
        height: 150px;
        background: #f09;
    }
    #close {
        position: absolute;
        top: 620px;
        left: 40px;
    }
    #inner-done {
        position: absolute;
        top: 620px;
        left: 120px;
    }
</style>
