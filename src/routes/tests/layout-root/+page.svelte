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
    // Once a recording ends (1.3 s after the click), read the new underline's
    // offset from the list in every frame after the click rendered. RELATIVE
    // if it starts near 0, never goes back and ends near 100; PAGE SPACE
    // otherwise.

    type Verdict = 'waiting' | 'recording' | 'relative' | 'page-space'
    let verdict = $state<Verdict>('waiting')
    let lastStart = $state<number | null>(null)

    const judge = (records: FrameRecord[]): Verdict => {
        const first = records.findIndex(({ rendered }) => rendered)
        const frames = first < 0 ? [] : records.slice(first)
        if (frames.length < 5) return 'page-space'
        const offsets = frames.map(
            ({ underlines, list }) => underlines[underlines.length - 1] - list
        )
        const monotonic = offsets.every((o, i) => i === 0 || o >= offsets[i - 1] - 0.5)
        const relative =
            Math.abs(offsets[0]) < 5 &&
            monotonic &&
            Math.abs(offsets[offsets.length - 1] - 100) < 1 &&
            offsets.every((o) => o >= -0.5 && o <= 100.5)
        lastStart = offsets[0]
        return relative ? 'relative' : 'page-space'
    }

    const testerSelect = (item: string) => {
        select(item)
        if (isPlaywright()) return
        verdict = 'recording'
        setTimeout(() => {
            const w = recordingWindow()
            w.recording = false
            verdict = judge(w.records)
        }, 1300)
    }

    const reset = () => {
        showSidebar = false
        selected = outside ? '' : tabs[0]
        verdict = 'waiting'
        lastStart = null
    }

    const steps: TesterStep[] = [
        {
            text: 'Click "🥬 Lettuce".',
            expected:
                'A grey sidebar appears and the whole tab bar jumps left in one frame. The blue underline slides exactly one tab, from under Tomato to under Lettuce, over one second. The chip reads RELATIVE ✓.',
            action: { label: 'Select Lettuce', run: () => testerSelect(tabs[1]) }
        },
        {
            text: 'Click "🍅 Tomato" to reset (the sidebar goes away), then open the layoutRoot=false variant from the link below.',
            expected: 'The page reloads without the layout root.',
            action: { label: 'Reset', run: reset }
        },
        {
            text: 'Click "🥬 Lettuce" there.',
            expected:
                'The tab bar still jumps, but the underline drifts in from where Tomato used to be on the page (right of the new Lettuce) instead of sliding one tab. The chip reads PAGE SPACE.',
            action: { label: 'Select Lettuce', run: () => testerSelect(tabs[1]) }
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
    status="Passes on this build (Motion 14.7.1), apart from the exit=true crossfades (plan 012)."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict === 'relative'
                ? 'ok'
                : verdict === 'page-space'
                  ? 'bad'
                  : 'na'}"
        >
            {verdict === 'relative'
                ? 'RELATIVE ✓'
                : verdict === 'page-space'
                  ? 'PAGE SPACE'
                  : verdict === 'recording'
                    ? 'RECORDING'
                    : 'WAITING'}
        </span>
        {#if lastStart !== null}
            <span class="readout">starts {lastStart.toFixed(1)}px into the list</span>
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
