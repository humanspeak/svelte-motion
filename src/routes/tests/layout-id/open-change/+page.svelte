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
    const params = page.url.searchParams
    const isPlaywright = params.get('@isPlaywright') === 'true'
    const owned = params.get('owned') === 'true'
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
    // Each action is judged from the recorded frames over the 2 s animation
    // that follows it (the specs judge their own frames, so the verdict is
    // off under `@isPlaywright`).
    //
    // - Next (card at rest): the card stays put and opaque, thumbnail one
    //   starts at the card's box and ends home, thumbnail two is hidden.
    //   Next mid-open: the card finishes opening, one ends home, two hidden.
    // - Close: the thumbnail the card was showing starts at about the card's
    //   size and shrinks home to 160px, while the card stays mounted for most
    //   of it (held, crossfading out).
    type Verdict = 'waiting' | 'recording' | 'ok' | 'bad'
    let verdict = $state<Verdict>('waiting')
    let judged = $state<string | null>(null)
    let readout = $state<string | null>(null)
    type Box = {
        x: number
        y: number
        width: number
        height: number
        opacity: number
        visibility: string
    }
    type Frame = Partial<Record<'one' | 'two' | 'card', Box>>
    const hidden = (box?: Box) => !box || box.visibility === 'hidden' || box.opacity < 0.01
    const near = (a: Box, b: Box, tolerance: number) =>
        Math.abs(a.x - b.x) < tolerance &&
        Math.abs(a.y - b.y) < tolerance &&
        Math.abs(a.width - b.width) < tolerance &&
        Math.abs(a.height - b.height) < tolerance

    let judging = 0
    const judge = (label: string, test: (frames: Frame[]) => [boolean, string]) => {
        if (isPlaywright) return
        const w = window as unknown as RecordingWindow
        const start = w.frames.length - 1
        const run = ++judging
        verdict = 'recording'
        judged = label
        readout = null
        setTimeout(() => {
            if (run !== judging) return
            const [ok, text] = test(w.frames.slice(start) as Frame[])
            verdict = ok ? 'ok' : 'bad'
            readout = text
        }, 2300)
    }

    const judgeNext = () =>
        judge('next', ([before, ...after]) => {
            const card = before.card
            if (!card) return [false, 'no card was open']
            const atRest = Math.abs(card.width - 400) < 1
            const last = after.at(-1)!
            const oneHome = !!last.one && Math.abs(last.one.width - 160) < 2
            const twoHidden = after.slice(2).every((f) => hidden(f.two))
            if (!atRest) {
                const opened = !!last.card && Math.abs(last.card.width - 400) < 2
                return [
                    opened && oneHome && twoHidden,
                    `mid-open: card ends ${last.card?.width.toFixed(0)}px wide, one ends ${last.one?.width.toFixed(0)}px, two ${twoHidden ? 'hidden' : 'SHOWN'}`
                ]
            }
            const moved = after.filter(
                (f) => !f.card || !near(f.card, card, 2) || f.card.opacity < 0.99
            )
            const first = after.find((f) => !hidden(f.one) && !near(f.one!, card, 1))
            const fromCard = !!first && Math.abs(first.one!.width - card.width) < 40
            return [
                !moved.length && fromCard && oneHome && twoHidden,
                `card ${moved.length ? `moved in ${moved.length} frames` : 'stayed put'}; one ${first?.one?.width.toFixed(0)} → ${last.one?.width.toFixed(0)}px; two ${twoHidden ? 'hidden' : 'SHOWN'}`
            ]
        })

    const judgeClose = (id: string) =>
        judge(`close into ${id}`, (frames) => {
            const key = id as 'one' | 'two'
            const widths = frames.flatMap((f) => (f[key] && !hidden(f[key]) ? [f[key]!.width] : []))
            const held = frames.filter((f) => f.card).length
            const ok =
                widths.length > 10 &&
                widths[1] > 300 &&
                Math.abs(widths[widths.length - 1] - 160) < 2 &&
                held > frames.length / 2
            return [
                ok,
                `${id} ${widths[1]?.toFixed(0)} → ${widths.at(-1)?.toFixed(0)}px; card held ${held}/${frames.length} frames`
            ]
        })

    // The page buttons, the thumbnails and the tester steps share these.
    const openThumb = (id: string) => {
        if (open && open !== id) {
            mark('changedAt')
            judgeNext()
        }
        open = id
    }
    const next = () => {
        mark('changedAt')
        if (open) judgeNext()
        open = 'two'
    }
    const close = () => {
        mark('closedAt')
        if (open) judgeClose(open)
        open = null
    }

    const variants = [
        { label: 'clone (default)', query: '' },
        { label: 'owned', query: 'owned=true' }
    ]
    const keep = isPlaywright ? '@isPlaywright=true' : ''
    const variantHref = (query: string) => `?${[keep, query].filter(Boolean).join('&')}`
    const current = owned ? 'owned' : 'clone (default)'

    const steps: TesterStep[] = [
        {
            text: 'Click the red thumbnail ("one").',
            expected:
                'A grey card grows out of thumbnail one over two seconds, and thumbnail one fades out.',
            action: { label: 'Open one', run: () => openThumb('one') }
        },
        {
            text: 'When the card is fully open, click "next".',
            expected:
                "The card stays exactly where it is (no re-grow, no flash). Thumbnail one reappears at the card's size and shrinks home over two seconds; thumbnail two disappears. The chip reads NEXT ✓.",
            action: { label: 'Next', run: next }
        },
        {
            text: 'Click "close".',
            expected:
                'Thumbnail two grows back out of the card and shrinks home over two seconds, while the card stays and fades out, gone when it lands. The chip reads CLOSE INTO TWO ✓.',
            action: { label: 'Close', run: close }
        },
        {
            text: 'Open one again, close, and click thumbnail one again while it is still shrinking home.',
            expected:
                'The card grows back out from wherever thumbnail one had got to, with no jump. Close again: it shrinks into thumbnail one and the chip reads CLOSE INTO ONE ✓.'
        },
        {
            text: 'Click "next" about half a second after opening one, while the card is still growing.',
            expected:
                'The card keeps growing to its full size, thumbnail one heads home, two disappears. The chip reads NEXT ✓.'
        },
        {
            text: 'Switch to the other variant with the links next to the chip and repeat.',
            expected: 'Both variants look the same.'
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
            onclick={() => openThumb(id)}
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
    <button id="next" type="button" style="position: absolute; top: 550px;" onclick={next}>
        next
    </button>
    <button
        id="close"
        type="button"
        style="position: absolute; top: 550px; left: 100px;"
        onclick={close}
    >
        close
    </button>
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · #1411"
    title="Change an open card's layoutId, then close it"
    status="Plan 012: next switches the card in place; closing holds it while it crossfades into its thumbnail, on both syntaxes."
    {steps}
>
    {#snippet summary()}
        <span class="verdict {verdict === 'ok' ? 'ok' : verdict === 'bad' ? 'bad' : 'na'}">
            {verdict === 'ok'
                ? `${judged?.toUpperCase()} ✓`
                : verdict === 'bad'
                  ? `${judged?.toUpperCase()} ✗`
                  : verdict === 'recording'
                    ? `RECORDING ${judged?.toUpperCase()}`
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
            Upstream the closing card is relegated: thumbnail two takes the lead again and grows out
            of the card, while the card stays mounted and fades out until that animation ends.
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
    .readout {
        font-size: 0.75rem;
        color: #475569;
    }
</style>
