<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
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
    // ?instant=true uses `{ type: false }`; the default is `{ duration: 0.01 }`.
    // ?duration=<s> sets another duration (plan 012 A1, for the painted close).
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

    const instant = page.url.searchParams.get('instant') === 'true'
    // `?duration=<s>` slows the shared transition so a spec can judge the
    // close from painted frames (plan 012 A1); not in upstream.
    const duration = page.url.searchParams.get('duration')
    const transition = (
        instant ? { type: false } : { duration: duration ? Number(duration) : 0.01 }
    ) as MotionTransition

    const numColors = 3
    const makeColor = (hue: number) => `hsl(${hue}, 100%, 50%)`
    const colors = Array.from(Array(numColors)).map((_, i) =>
        makeColor(Math.round((360 / numColors) * i))
    )

    let open = $state<false | string>(false)
    // Set on mount, so the specs don't click before hydration.
    let hydrated = $state(false)
    onMount(() => (hydrated = true))
    let shownColor = $state(colors[0])
    $effect.pre(() => {
        if (open !== false) shownColor = open
    })

    const steps: TesterStep[] = [
        {
            text: 'Click the red gallery item.',
            expected:
                'A white rounded card with a black dot opens in the middle over a dark overlay. The red item underneath is hidden while the card leads its layoutId.',
            action: { label: 'Open red', run: () => (open = colors[0]) }
        },
        {
            text: 'Click the dark overlay.',
            expected:
                'The card closes back into the red item: the red item is visible again, square-cornered, with its translucent dot in the centre.',
            action: { label: 'Close', run: () => (open = false) }
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
    {#snippet checks()}
        <p>
            Both the card and its dot have their own <code>layoutId</code>, as do the gallery item
            and its dot. Each nested node relegates and holds on close, as each nested
            <code>MeasureLayout</code> does upstream. While the card is scaled, motion-dom's scale correctors
            keep the radii right.
        </p>
        <p>Variants: <a href="?instant=true">instant</a> · <a href="?">0.01s (default)</a></p>
    {/snippet}
</TesterPanel>

<style>
    .lightbox-fixture,
    .lightbox-fixture :global(*) {
        box-sizing: content-box;
    }
</style>
