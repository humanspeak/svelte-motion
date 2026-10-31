<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
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
    // The nested boundary's `onExitComplete` counts into `#inner-done`.
    //
    // Every rAF, `window.nestedLog` records the clone copy of `#fade` (its
    // computed `opacity` and the scale of its computed `transform`), whether the
    // lightbox clone is connected, and `#inner-done`'s count.

    const params = page.url.searchParams
    const inner = params.get('inner')
    const innerExit = params.get('innerExit') === 'true'
    const fast = params.get('fast') === 'true'
    const plainOuter = params.get('outer') === 'plain'

    const transition = { duration: fast ? 0.3 : 1, ease: 'linear' as const }
    const fadeTransition = { duration: 1, ease: 'linear' as const }
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

    const steps: TesterStep[] = [
        {
            text: 'Click the red gallery item.',
            expected:
                'The white card grows out of the red item and its black dot grows out of the item’s white dot.',
            action: { label: 'Open red', run: () => (open = colors[0]) }
        },
        {
            text: 'Click "close".',
            expected:
                'The card shrinks back into the red item while it fades, and its black dot shrinks into the item’s white dot: both stay mounted until they land.',
            action: { label: 'Close', run: () => (open = false) }
        },
        {
            text: 'Open the variants below and repeat.',
            expected:
                'inner=boundary: the dot rides the card and is not relegated; inner=propagate: the dot relegates like the default; innerExit: the inner square fades and shrinks over one second and the card waits for it.'
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
                    transition={{ duration: 0.3 }}
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
    {#snippet checks()}
        <p>
            The lightbox is a direct <code>motion.div</code> child of <code>AnimatePresence</code>,
            so it exits as a clone. Its nested <code>layoutId</code> dot moves to the clone with its projection
            node, relegates and crossfades into the gallery dot.
        </p>
        <p>
            Variants:
            <a href="?inner=boundary">inner=boundary</a> ·
            <a href="?inner=propagate">inner=propagate</a> ·
            <a href="?inner=propagate&innerExit=true&fast=true">propagate + innerExit</a> ·
            <a href="?outer=plain&inner=propagate&innerExit=true">outer=plain</a> ·
            <a href="?">default</a>
        </p>
    {/snippet}
</TesterPanel>

<style>
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
