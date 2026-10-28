<script lang="ts">
    /**
     * Port of upstream motion `dev/react/src/tests/issue-1935.tsx` @ v14.7.1
     * (https://github.com/motiondivision/motion/issues/1935, motion-dom commits
     * 012185841, 79a4865e7, 64c6818bb and 95c017019). e2e/layout/layout-root.spec.ts.
     *
     * #1935: the docs' tabs example with a sidebar that appears when Lettuce
     * is selected. The window is centred, so the sidebar shifts the tabs left
     * in the same render as the shared `layoutId` underline moves to Lettuce.
     * The tab list is a `layoutRoot`, so the underline should animate relative
     * to it, not from where Tomato was on the page before the shift.
     *
     * Every frame from the click onwards, `window.records` gets the left and
     * top edges of the underlines (in document order) and of the tab list, and
     * whether the click has rendered yet.
     *
     * ?exit=true keeps the old underline mounted while it fades out, so the
     * two crossfade. ?outside=true starts the underline in a box outside the
     * list. ?layoutRoot=false makes the list a plain element. ?offset=true
     * moves the whole window with a translate on an ancestor of the list.
     * ?layout=position (or size) makes Lettuce wider and sets the underline's
     * layout prop. ?outsideX=<px> translates the outside box. ?innerX=<px>
     * wraps Tomato's underline in a translated box inside its tab, within the
     * list. ?scroll=<px> puts the tabs in a scrolled layoutScroll box in the
     * list. ?underlineX=<px> translates the underlines. ?offsetScale=<n> also
     * scales the ?offset ancestor.
     *
     * Deviations: direct `AnimatePresence` children need a `key`. The fixture
     * sits in a `position: fixed` full-window box so the route layout's
     * centring can't shift it, and its CSS is scoped to that box.
     *
     * @component
     */
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../layout/_parity/TesterPanel.svelte'

    const tabs = ['🍅 Tomato', '🥬 Lettuce', '🧀 Cheese']

    type FrameRecord = {
        underlines: number[]
        underlineTops: number[]
        underlineWidths: number[]
        list: number
        listTop: number
        rendered: boolean
    }
    type RecordingWindow = Window & { records: FrameRecord[]; recording: boolean }

    const params = page.url.searchParams
    const layoutRoot = params.get('layoutRoot') !== 'false'
    // Keep the old underline mounted while it exits, so the two crossfade
    const exit = params.get('exit') === 'true'
    // Start with the underline in a box outside the tab list
    const outside = params.get('outside') === 'true'
    // Translate an ancestor of the layoutRoot, and scale it by offsetScale
    const offset = params.get('offset') === 'true'
    const offsetScale = Number(params.get('offsetScale') || 1)
    // Translate the box outside the tab list
    const outsideX = parseInt(params.get('outsideX') || '0')
    // Only animate the underline's position or size, to a wider tab
    const layoutType = params.get('layout') as 'position' | 'size' | null
    // Translate a box around Tomato's underline, inside the list
    const innerX = parseInt(params.get('innerX') || '0')
    // Scroll the tabs inside a layoutScroll box in the list by this many px
    const scroll = parseInt(params.get('scroll') || '0')
    // Translate the underlines themselves
    const underlineX = parseInt(params.get('underlineX') || '0')

    let selected = $state(outside ? '' : tabs[0])
    // Set on mount, so the spec doesn't click before hydration
    let hydrated = $state(false)
    let showSidebar = $state(false)

    const transition = { duration: 1, ease: 'linear' } as const

    const recordingWindow = () => window as unknown as RecordingWindow

    function record() {
        const w = recordingWindow()
        if (!w.recording) return
        const underlines = Array.from(document.querySelectorAll('.fixture-1935 .underline'), (u) =>
            u.getBoundingClientRect()
        )
        const list = document.querySelector('.fixture-1935 ul')!.getBoundingClientRect()
        w.records.push({
            underlines: underlines.map(({ left }) => left),
            underlineTops: underlines.map(({ top }) => top),
            underlineWidths: underlines.map(({ width }) => width),
            list: list.left,
            listTop: list.top,
            rendered: Boolean(document.querySelector('.fixture-1935 aside'))
        })
        requestAnimationFrame(record)
    }

    const select = (item: string) => {
        const w = recordingWindow()
        w.records = []
        w.recording = true
        requestAnimationFrame(record)
        showSidebar = item === tabs[1]
        selected = item
    }

    const isPlaywright = () => window.location.search.includes('@isPlaywright=true')

    onMount(() => {
        const w = recordingWindow()
        w.records = []
        hydrated = true
        if (scroll)
            document.querySelector<HTMLElement>('.fixture-1935 .scroller')!.scrollLeft = scroll
    })

    // ---- Live verdict (tester only) ----
    //
    // Judges every tab change, both ways: upstream's #1935 handling has no
    // direction (`notifyLayoutUpdate`, `resolveTargetDelta`). Just before a
    // click, note the old underline's left edge and width
    // and the list's left edge. When the recording ends (1.3 s later), check
    // the new underline's path in every frame after the click rendered,
    // against what Motion does for this variant:
    //
    // - inside a layoutRoot, when the old underline was inside the list too,
    //   its left edge moves relative to the list: from the old offset within
    //   the old list (0, or 80 with innerX) to its new offset;
    // - otherwise (no root, coming from the outside box, or arriving inside a
    //   translated box) it moves in page space, from the old underline's page
    //   position;
    // - layout="size" keeps x at its new place and animates only the width,
    //   from the old width to the new one; layout="position" keeps the new
    //   width throughout.
    //
    // MATCHES if the path starts at the expected point, never turns back,
    // stays between its ends, passes through the middle and ends in place.

    type Verdict = 'waiting' | 'recording' | 'matches' | 'off-path'
    type Before = { left: number; width: number; listLeft: number; insideList: boolean }
    let verdict = $state<Verdict>('waiting')
    let readout = $state<string | null>(null)

    const measureBefore = (): Before | null => {
        const old = document.querySelector('.fixture-1935 .underline')
        const list = document.querySelector('.fixture-1935 ul')
        if (!old || !list) return null
        const box = old.getBoundingClientRect()
        return {
            left: box.left,
            width: box.width,
            listLeft: list.getBoundingClientRect().left,
            insideList: list.contains(old)
        }
    }

    /** Whether `values` run from `from` to `to` without turning back. */
    const followsPath = (values: number[], from: number, to: number) => {
        const lo = Math.min(from, to) - 0.5
        const hi = Math.max(from, to) + 0.5
        const sign = Math.sign(to - from)
        const range = Math.abs(to - from)
        return (
            Math.abs(values[0] - from) < 5 &&
            values.every((v) => v >= lo && v <= hi) &&
            values.every((v, k) => k === 0 || sign * (v - values[k - 1]) >= -0.5) &&
            (range < 10 ||
                values.some(
                    (v) => Math.abs(v - from) > range * 0.3 && Math.abs(v - to) > range * 0.3
                )) &&
            Math.abs(values[values.length - 1] - to) < 1
        )
    }

    const judge = (records: FrameRecord[], before: Before, sidebar: boolean): Verdict => {
        // The click has rendered once the sidebar shows (or hides) as it should.
        const first = records.findIndex(({ rendered }) => rendered === sidebar)
        const frames = first < 0 ? [] : records.slice(first)
        if (frames.length < 5) {
            readout = 'too few frames recorded'
            return 'off-path'
        }
        const last = frames[frames.length - 1]
        const listLeft = last.list
        // motion-dom's `getClosestProjectingParent` (create-projection-node.ts
        // 1435-1442 @ v14.7.1) gives no relative parent when the node's
        // parent has a scale or a 2D translate. So an underline arriving
        // inside a translated box (innerX, back to Tomato) animates in page
        // space even inside the root.
        // (Skip `AnimatePresence`'s `display: contents` wrapper.)
        const arriving = document.querySelectorAll('.fixture-1935 .underline')
        let arrivingParent = arriving[arriving.length - 1]?.parentElement ?? null
        while (arrivingParent && getComputedStyle(arrivingParent).display === 'contents') {
            arrivingParent = arrivingParent.parentElement
        }
        const parentTransformed =
            !!arrivingParent && getComputedStyle(arrivingParent).transform !== 'none'
        const relative = layoutRoot && before.insideList && !parentTransformed
        // Left edges in list-relative px when relative, else page px
        // measured from the new list, so both read the same way.
        const lefts = frames.map(({ underlines, list }) =>
            relative
                ? underlines[underlines.length - 1] - list
                : underlines[underlines.length - 1] - listLeft
        )
        const widths = frames.map(
            ({ underlineWidths }) => underlineWidths[underlineWidths.length - 1]
        )
        const from = relative ? before.left - before.listLeft : before.left - listLeft
        const to = lefts[lefts.length - 1]
        const finalWidth = widths[widths.length - 1]
        const space = relative ? 'from the list' : 'page, from the list'
        let ok: boolean
        if (layoutType === 'size') {
            ok =
                lefts.every((l) => Math.abs(l - to) < 1) &&
                followsPath(widths, before.width, finalWidth)
            readout = `x stays ${to.toFixed(0)}px ${space}; width ${widths[0].toFixed(0)} → ${finalWidth.toFixed(0)} (expected ${before.width.toFixed(0)} → ${finalWidth.toFixed(0)})`
        } else {
            const widthOk = widths.every((w) => Math.abs(w - finalWidth) < 1)
            ok = followsPath(lefts, from, to) && (layoutType !== 'position' || widthOk)
            readout = `x ${lefts[0].toFixed(0)} → ${to.toFixed(0)}px ${space} (expected ${from.toFixed(0)} → ${to.toFixed(0)}, ${relative ? 'relative' : 'page space'})`
        }
        return ok ? 'matches' : 'off-path'
    }

    const testerSelect = (item: string) => {
        if (isPlaywright()) {
            select(item)
            return
        }
        if (item === selected) return
        const before = measureBefore()
        select(item)
        if (!before) return
        verdict = 'recording'
        readout = null
        setTimeout(() => {
            const w = recordingWindow()
            w.recording = false
            verdict = judge(w.records, before, item === tabs[1])
        }, 1300)
    }

    const steps: TesterStep[] = [
        {
            text: 'Click "🥬 Lettuce".',
            expected:
                'A grey sidebar appears and the whole tab bar jumps left in one frame. The blue underline slides exactly one tab, from under Tomato to under Lettuce, over one second. The chip reads MATCHES ✓ and the readout says x 0 → 100 relative.',
            action: { label: 'Select Lettuce', run: () => testerSelect(tabs[1]) }
        },
        {
            text: 'Click "🍅 Tomato".',
            expected:
                'The sidebar goes, the bar jumps back right, and the underline slides one tab back (x 100 → 0 relative). MATCHES ✓.',
            action: { label: 'Select Tomato', run: () => testerSelect(tabs[0]) }
        },
        {
            text: 'Open each variant link in the panel and click Lettuce, then Tomato, there.',
            expected:
                'Every click reads MATCHES ✓. layoutRoot=false moves in page space (150 → 100 from the new list, and back -50 → 0); innerX=80 starts 80px into the list, and back to Tomato it moves in page space (its translated box turns relative projection off, as in Motion); layout=size keeps x and animates only the width; outside starts from the box left of the list (50 → 100).'
        }
    ]
</script>

<svelte:head>
    <title>layoutRoot · shared layoutId relative to its layout root (#1935)</title>
</svelte:head>

{#snippet underline(item: string)}
    <AnimatePresence>
        {#if item === selected}
            <motion.div
                key="underline"
                class="underline"
                layoutId="underline"
                layout={layoutType || undefined}
                style={{ x: underlineX }}
                exit={exit ? { opacity: 0 } : undefined}
                {transition}
            />
        {/if}
    </AnimatePresence>
{/snippet}

{#snippet tabItems()}
    {#each tabs as item (item)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <li
            id={item.split(' ')[1].toLowerCase()}
            class={layoutType ? 'wide' : undefined}
            onclick={() => (isPlaywright() ? select(item) : testerSelect(item))}
        >
            {item}
            {#if item === tabs[0] && innerX}
                <motion.div class="inner" style={{ x: innerX }}>
                    {@render underline(item)}
                </motion.div>
            {:else}
                {@render underline(item)}
            {/if}
        </li>
    {/each}
{/snippet}

{#snippet content()}
    <div class="window">
        {#if outside}
            <motion.div class="outside" style={{ x: outsideX }}>
                <AnimatePresence>
                    {#if !selected}
                        <motion.div
                            key="underline"
                            class="underline"
                            layoutId="underline"
                            exit={exit ? { opacity: 0 } : undefined}
                            {transition}
                        />
                    {/if}
                </AnimatePresence>
            </motion.div>
        {/if}
        <nav>
            <motion.ul layout={layoutRoot} {layoutRoot}>
                {#if scroll}
                    <motion.div class="scroller" layoutScroll>
                        {@render tabItems()}
                        <li></li>
                    </motion.div>
                {:else}
                    {@render tabItems()}
                {/if}
            </motion.ul>
        </nav>
        {#if showSidebar}
            <aside></aside>
        {/if}
    </div>
{/snippet}

<div class="fixture-1935" data-hydrated={hydrated || undefined}>
    {#if offset}
        <motion.div style={{ x: 50, y: 50, scale: offsetScale }}>
            {@render content()}
        </motion.div>
    {:else}
        {@render content()}
    {/if}
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · #1935"
    title="Shared layoutId inside a layoutRoot"
    status="Passes on this build (Motion 14.7.1). The exit=true crossfades wait for plan 012."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict === 'matches' ? 'ok' : verdict === 'off-path' ? 'bad' : 'na'}"
        >
            {verdict === 'matches'
                ? 'MATCHES ✓'
                : verdict === 'off-path'
                  ? 'OFF PATH ✗'
                  : verdict === 'recording'
                    ? 'RECORDING'
                    : 'WAITING'}
        </span>
        {#if readout}
            <span class="readout">{readout}</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The tab list is a <code>motion.ul</code> with <code>layout</code> and
            <code>layoutRoot</code>. Selecting Lettuce shows a sidebar in the same update, so the
            centred list jumps 150px left while the shared <code>layoutId</code> underline moves to Lettuce.
        </p>
        <p>
            Since Motion 14.7.1 the underline animates relative to the layout root when the previous
            underline was inside it too: it slides one tab (0 → 100px from the list's left edge).
            Without the root it animates in page space, from Tomato's old page position. The root's
            own layout change is instant.
        </p>
        <p>
            Variants:
            <a href="?layoutRoot=false">layoutRoot=false</a> ·
            <a href="?offset=true">offset</a> ·
            <a href="?outside=true">outside</a> ·
            <a href="?layout=position">layout=position</a> ·
            <a href="?layout=size">layout=size</a> ·
            <a href="?layoutRoot=false&layout=position">layoutRoot=false&amp;layout=position</a> ·
            <a href="?layoutRoot=false&layout=size">layoutRoot=false&amp;layout=size</a> ·
            <a href="?innerX=80">innerX=80</a> ·
            <a href="?">default</a>
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture-1935 {
        position: fixed;
        inset: 0;
        overflow: hidden;
        background: white;
        color: black;
    }
    .fixture-1935 :global(.window) {
        display: flex;
        justify-content: center;
        padding-top: 50px;
    }
    .fixture-1935 :global(ul) {
        display: flex;
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .fixture-1935 :global(li),
    .fixture-1935 :global(.outside) {
        position: relative;
        width: 100px;
        height: 40px;
        cursor: pointer;
    }
    .fixture-1935 :global(.underline) {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: blue;
    }
    .fixture-1935 :global(.scroller) {
        display: flex;
        width: 300px;
        overflow-x: scroll;
    }
    .fixture-1935 :global(.scroller li) {
        flex-shrink: 0;
    }
    .fixture-1935 :global(.inner) {
        position: absolute;
        inset: 0;
    }
    .fixture-1935 :global(#lettuce.wide) {
        width: 160px;
    }
    .fixture-1935 :global(aside) {
        width: 300px;
        height: 40px;
        background: #eee;
    }

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
