<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import { SvelteURLSearchParams } from 'svelte/reactivity'
    import type { MotionTransition } from '$lib/types'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import SingleImage from './SingleImage.svelte'

    // Port of upstream motion `dev/react/src/tests/layout-shared-lightbox-crossfade.tsx`
    // @ v14.7.1, checked by
    // `packages/framer-motion/cypress/integration/layout-shared-lightbox-crossfade.ts`
    // (`runScriptCrossfade`). e2e/layout-id/lightbox-crossfade.spec.ts (plan 012).
    //
    // A gallery of `layoutId={color}` items, each holding a
    // `layoutId="child-{color}"` dot. Clicking an item opens a lightbox whose
    // card and dot share those ids, so both grow out of the item. Clicking the
    // overlay closes it: the card and the dot are relegated, the gallery item
    // and its dot are promoted again and the lightbox is held until they have
    // animated home.
    //
    // ?instant=true uses `{ type: false }`. The specs (`@isPlaywright=true`)
    // default to upstream's `{ duration: 0.01 }`; a human tester gets 1.5 s so
    // the crossfade can be watched. ?duration=<s> sets another duration
    // either way (plan 012 A1, for the painted close).
    //
    // Deviations:
    // - Upstream's `AnimatePresence` child is `SingleImage`, a plain component
    //   holding the overlay and the nested motion nodes. Only the owned syntax
    //   (`present` + `child`) can express that in Svelte, so this port uses it.
    // - Upstream keys `SingleImage` by the open colour; it can't change while
    //   the lightbox is open in this fixture, so the key is dropped.
    // - A snippet reads live state, where upstream re-renders an exiting
    //   child with its last props: `open` goes `false` while the lightbox is
    //   held, so `SingleImage` reads `shownColor`, latched while open.
    // - Tailwind's preflight makes every box `border-box`; the fixture resets
    //   it to the browser default upstream's dev harness has.
    // - `?partial-ease` and `?type` (only used by upstream's commented-out
    //   switch spec) are not ported.

    const params = page.url.searchParams
    const isPlaywright = params.get('@isPlaywright') === 'true'
    const instant = params.get('instant') === 'true'
    // `?duration=<s>` slows the shared transition so a spec can judge the
    // close from painted frames (plan 012 A1); not in upstream.
    const duration = Number(params.get('duration') ?? (isPlaywright ? 0.01 : 1.5))
    const transition = (instant ? { type: false } : { duration }) as MotionTransition
    // A URL for this page with some params changed (`null` removes one).
    const hrefWith = (changes: Record<string, string | null>) => {
        const next = new SvelteURLSearchParams(params)
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key)
            else next.set(key, value)
        }
        const query = next.toString()
        return query ? `?${query}` : '?'
    }

    const numColors = 3
    const makeColor = (hue: number) => `hsl(${hue}, 100%, 50%)`
    const colors = Array.from(Array(numColors)).map((_, i) =>
        makeColor(Math.round((360 / numColors) * i))
    )

    let open = $state<false | string>(false)
    // Set on mount, so the specs don't click before hydration.
    let hydrated = $state(false)

    // ---- Live verdict (tester only) ----
    //
    // After a close, watch every frame until the card is removed: the card
    // must stay mounted while the red item grows back (it is held for the
    // shared animation), and the red item must end fully visible.
    type Verdict = 'waiting' | 'watching' | 'ok' | 'early' | 'hidden'
    let verdict = $state<Verdict>('waiting')
    let readout = $state<string | null>(null)
    onMount(() => {
        hydrated = true
        if (isPlaywright) return
        let wasOpen = open !== false
        let closedAt: number | null = null
        let raf = 0
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            const isOpen = open !== false
            if (wasOpen && !isOpen) {
                closedAt = now
                verdict = 'watching'
                readout = null
            }
            wasOpen = isOpen
            if (closedAt === null) return
            const elapsed = (now - closedAt) / 1000
            if (document.getElementById('parent')) {
                readout = `card held ${elapsed.toFixed(2)} s…`
                return
            }
            const item = document.getElementById('item-parent')
            const itemOpacity = item ? Number(getComputedStyle(item).opacity) : 0
            if (!instant && elapsed < duration * 0.9) {
                verdict = 'early'
                readout = `card removed after ${elapsed.toFixed(2)} s, before the animation ended`
            } else if (itemOpacity < 1) {
                verdict = 'hidden'
                readout = `red item left at opacity ${itemOpacity}`
            } else {
                verdict = 'ok'
                readout = `card held ${elapsed.toFixed(2)} s, red item back`
            }
            closedAt = null
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })
    let shownColor = $state(colors[0])
    $effect.pre(() => {
        if (open !== false) shownColor = open
    })

    const steps: TesterStep[] = [
        {
            text: 'Click the red gallery item.',
            expected: `Over ${instant ? 'no time' : `${duration} s`}, a white rounded card grows out of the red item into the middle, over a dark overlay, and the red item's dot grows into the card's black dot. The red item underneath is hidden while the card is open.`,
            action: { label: 'Open red', run: () => (open = colors[0]) }
        },
        {
            text: 'Click the dark overlay.',
            expected:
                "The card shrinks back into the red item while crossfading into it, and the dot shrinks back into the item's dot. Corners stay round (no stretched or squashed radius) all the way. At the end the red item is back, square-cornered, with its translucent dot. The chip reads HELD ✓.",
            action: { label: 'Close', run: () => (open = false) }
        },
        {
            text: 'Try the green and blue items too, then click "instant" next to the chip and repeat.',
            expected:
                'The same for each colour. With instant there is no animation: the card appears and disappears at once, and the item is back straight away.'
        }
    ]
</script>

<svelte:head>
    <title>layoutId · lightbox crossfade with nested shared children</title>
</svelte:head>

<div
    class="lightbox-fixture"
    data-hydrated={hydrated || undefined}
    style="position: fixed; top: 0; left: 0; bottom: 0; right: 0; display: flex; justify-content: center; align-items: center; background: #ccc;"
>
    <ul
        style="background-color: #eeeeee; border-radius: 25px; width: 600px; height: 600px; margin: 0; padding: 0 20px 20px 0; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: space-between; list-style: none;"
    >
        {#each colors as color, i (color)}
            <motion.li
                onclick={() => (open = color)}
                style={{
                    padding: '20px',
                    cursor: 'pointer',
                    margin: '20px 0 0 20px',
                    flex: '1 1 90px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: color,
                    borderRadius: 0
                }}
                layoutId={color}
                {transition}
                id={i === 0 ? 'item-parent' : undefined}
            >
                <motion.div
                    style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'white',
                        opacity: 0.5
                    }}
                    id={i === 0 ? 'item-child' : undefined}
                    layoutId="child-{color}"
                    {transition}
                />
            </motion.li>
        {/each}
    </ul>
    <AnimatePresence present={open !== false}>
        {#snippet child()}
            <SingleImage color={shownColor} {transition} close={() => (open = false)} />
        {/snippet}
    </AnimatePresence>
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · layout-shared-lightbox-crossfade"
    title="Lightbox crossfade with nested shared children"
    status="Plan 012: closing relegates the card and its dot back to the gallery item."
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
                ? 'HELD ✓'
                : verdict === 'early'
                  ? 'REMOVED EARLY ✗'
                  : verdict === 'hidden'
                    ? 'ITEM HIDDEN ✗'
                    : verdict === 'watching'
                      ? 'WATCHING'
                      : 'WAITING'}
        </span>
        {#if readout}<span class="readout">{readout}</span>{/if}
        <span class="variants">
            {#if instant}
                Instant · <a href={hrefWith({ instant: null })}>animated</a>
            {:else}
                {duration} s · <a href={hrefWith({ instant: 'true' })}>instant</a>
            {/if}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            Both the card and its dot have their own <code>layoutId</code>, as do the gallery item
            and its dot. Each nested node relegates and holds on close, as each nested
            <code>MeasureLayout</code> does upstream. While the card is scaled, motion-dom's scale correctors
            keep the radii right.
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
        margin-left: 0.75rem;
        font-size: 0.8rem;
    }
    .variants a {
        color: #2563eb;
        text-decoration: underline;
    }
    .lightbox-fixture,
    .lightbox-fixture :global(*) {
        box-sizing: content-box;
    }
</style>
