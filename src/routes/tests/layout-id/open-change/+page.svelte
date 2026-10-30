<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'

    // Port of upstream motion `dev/react/src/tests/issue-1411-open-change.tsx`
    // @ v14.7.1 (https://github.com/motiondivision/motion/issues/1411, commits
    // c3b7305ba, f58782f0e and 518b90659).
    //
    // A gallery whose thumbnails each have layoutId={id}, and a persistent
    // detail card with layoutId={open}. Opening "one" grows the card out of
    // thumbnail one. "Next" then changes the open card's layoutId to "two":
    //
    // - the card switches instantly, staying where it is (no re-grow),
    // - thumbnail one reappears, animating home from the card's box,
    // - thumbnail two disappears, as the card now leads its layoutId.
    //
    // Every frame's boxes, opacities and visibilities are recorded to
    // `window.frames` by a rAF loop, and `window.changedAt` / `closedAt` hold
    // the frame index at which "Next" / "Close" were clicked.
    //
    // Deviation: upstream renders in its own React root (outside the dev
    // harness's StrictMode), with `?strict=true` rendering inside it. Svelte
    // has no StrictMode, so there is one variant.
    // e2e/layout-id/open-change.spec.ts.
    //
    // ?owned=true renders the card through the owned syntax,
    // `<AnimatePresence present={!!open}>{#snippet child()}`, so the closing
    // card stays mounted as the real element (plan 012). Svelte deviation: a
    // snippet reads live state, so while the card is held after Close it
    // would see `open === null`, where upstream re-renders the exiting child
    // with its last props. The owned card reads `shown`, the id latched while
    // it was open.

    type Recorded = Record<string, object>
    // Not `Window &`: the DOM's own `window.frames` is typed as a Window.
    type RecordingWindow = {
        frames: Recorded[]
        changedAt?: number
        closedAt?: number
    }

    const transition = { type: 'tween' as const, ease: 'linear' as const, duration: 2 }
    const items = ['one', 'two']

    let open = $state<string | null>(null)
    const owned = page.url.searchParams.get('owned') === 'true'
    // The id the owned card was last shown with (see the header).
    let shown = $state<string | null>(null)
    $effect.pre(() => {
        if (open) shown = open
    })

    onMount(() => {
        const w = window as unknown as RecordingWindow
        w.frames = []
        let raf = 0
        const record = () => {
            const frame: Recorded = {}
            for (const id of ['one', 'two', 'card']) {
                const element = document.getElementById(id)
                if (!element) continue
                const { x, y, width, height } = element.getBoundingClientRect()
                const style = getComputedStyle(element)
                frame[id] = {
                    x,
                    y,
                    width,
                    height,
                    opacity: parseFloat(style.opacity),
                    visibility: style.visibility
                }
            }
            w.frames.push(frame)
            raf = requestAnimationFrame(record)
        }
        raf = requestAnimationFrame(record)
        return () => cancelAnimationFrame(raf)
    })

    const mark = (key: 'changedAt' | 'closedAt') => {
        const w = window as unknown as RecordingWindow
        w[key] = w.frames.length
    }
</script>

<svelte:head>
    <title>layoutId · change an open card's layoutId (#1411)</title>
</svelte:head>

<div style="position: relative; width: 800px; height: 600px;">
    {#each items as id, i (id)}
        <motion.div
            {id}
            layoutId={id}
            {transition}
            onclick={() => (open = id)}
            style="position: absolute; top: 50px; left: {20 +
                i * 180}px; width: 160px; height: 100px; background: {i ? 'royalblue' : 'tomato'};"
        />
    {/each}
    {#if owned}
        <AnimatePresence present={!!open}>
            {#snippet child()}
                <motion.div
                    id="card"
                    layoutId={shown ?? undefined}
                    {transition}
                    style="position: absolute; top: 210px; left: 200px; width: 400px; height: 280px; background: grey; z-index: 1;"
                />
            {/snippet}
        </AnimatePresence>
    {:else}
        <AnimatePresence>
            {#if open}
                <motion.div
                    key="card"
                    id="card"
                    layoutId={open}
                    {transition}
                    style="position: absolute; top: 210px; left: 200px; width: 400px; height: 280px; background: grey; z-index: 1;"
                />
            {/if}
        </AnimatePresence>
    {/if}
    <button
        id="next"
        type="button"
        style="position: absolute; top: 550px;"
        onclick={() => {
            mark('changedAt')
            open = 'two'
        }}
    >
        next
    </button>
    <button
        id="close"
        type="button"
        style="position: absolute; top: 550px; left: 100px;"
        onclick={() => {
            mark('closedAt')
            open = null
        }}
    >
        close
    </button>
</div>
