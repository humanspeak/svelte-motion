<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

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

    // ---- Live verdict (tester only) ----
    //
    // On Close, judge the recorded frames for 2.2 s: thumbnail two must
    // start at (about) the card's width and shrink home to 160px, and the
    // card must stay mounted for most of it (held, crossfading out).
    type Verdict = 'waiting' | 'recording' | 'grows-out' | 'snapped'
    let verdict = $state<Verdict>('waiting')
    let readout = $state<string | null>(null)
    type Box = { width: number }
    const judgeClose = () => {
        const w = window as unknown as RecordingWindow
        const start = w.closedAt ?? 0
        verdict = 'recording'
        setTimeout(() => {
            const frames = w.frames.slice(start) as Record<string, Box | undefined>[]
            const widths = frames.flatMap((f) => (f.two ? [f.two.width] : []))
            const held = frames.filter((f) => f.card).length
            const ok =
                widths.length > 10 &&
                widths[1] > 300 &&
                Math.abs(widths[widths.length - 1] - 160) < 2 &&
                held > frames.length / 2
            readout = `two ${widths[1]?.toFixed(0)} → ${widths.at(-1)?.toFixed(0)}px; card held ${held}/${frames.length} frames`
            verdict = ok ? 'grows-out' : 'snapped'
        }, 2200)
    }

    const isPlaywright = () => window.location.search.includes('@isPlaywright=true')
    const steps: TesterStep[] = [
        {
            text: 'Click the red thumbnail ("one").',
            expected: 'A grey card grows out of thumbnail one over two seconds.',
            action: { label: 'Open one', run: () => (open = 'one') }
        },
        {
            text: 'Click "next".',
            expected:
                'The card stays where it is (no re-grow, no crossfade). Thumbnail one reappears and animates home from the card; thumbnail two disappears.',
            action: {
                label: 'Next',
                run: () => {
                    mark('changedAt')
                    open = 'two'
                }
            }
        },
        {
            text: 'Click "close".',
            expected:
                'The card shrinks back into thumbnail two: thumbnail two grows out of the card while the card stays mounted and fades out, gone when the two seconds end. The chip reads GROWS OUT ✓.',
            action: {
                label: 'Close',
                run: () => {
                    mark('closedAt')
                    open = null
                    judgeClose()
                }
            }
        }
    ]
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
            if (!isPlaywright()) judgeClose()
        }}
    >
        close
    </button>
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · #1411"
    title="Change an open card's layoutId, then close it"
    status="Plan 012: closing holds the card while it crossfades into thumbnail two, on both syntaxes."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict === 'grows-out' ? 'ok' : verdict === 'snapped' ? 'bad' : 'na'}"
        >
            {verdict === 'grows-out'
                ? 'GROWS OUT ✓'
                : verdict === 'snapped'
                  ? 'SNAPPED ✗'
                  : verdict === 'recording'
                    ? 'RECORDING'
                    : 'WAITING'}
        </span>
        {#if readout}<span class="readout">{readout}</span>{/if}
    {/snippet}
    {#snippet checks()}
        <p>
            Upstream the closing card is relegated: thumbnail two takes the lead again and grows out
            of the card, while the card stays mounted and fades out until that animation ends.
        </p>
        <p>Variants: <a href="?owned=true">owned</a> · <a href="?">clone (default)</a></p>
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
</style>
