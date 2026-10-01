<script lang="ts">
    import { motion, useScroll, useTransform } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // useScroll({ target, offset }) runs on a native ViewTimeline when the
    // offset maps to one (Motion 13.4.7+ `offsetToViewTimelineRange`). A page
    // useScroll with an offset never does: a ScrollTimeline can't express an
    // offset, so Motion 13.5.0 keeps it on the main thread.

    let coverEl = $state<HTMLElement>()
    let enterEl = $state<HTMLElement>()

    // "While it's in view": newly native in Motion 13.4.7.
    const cover = useScroll({ target: () => coverEl, offset: ['start end', 'end start'] })
    // Enter: native on every version (control).
    const enter = useScroll({ target: () => enterEl, offset: ['start end', 'end end'] })
    // Page scroll with an offset: must stay on the JS path.
    const pageOffset = useScroll({ offset: ['start start', 'end end'] })

    const coverOpacity = useTransform(cover.scrollYProgress, [0, 1], [0.2, 1])
    const enterOpacity = useTransform(enter.scrollYProgress, [0, 1], [0.2, 1])
    const pageOpacity = useTransform(pageOffset.scrollYProgress, [0, 1], [0.2, 1])

    // ---- Tester readout (never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let supported = $state(false)
    let native = $state<Record<string, string>>({})

    /** Name of the native timeline driving an element's animation, if any. */
    const timelineOf = (el?: HTMLElement | null) =>
        el
            ?.getAnimations()
            .map((a) => a.timeline?.constructor?.name)
            .find((name) => name === 'ViewTimeline' || name === 'ScrollTimeline') ?? 'none (JS)'

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        supported = 'ViewTimeline' in window
        const read = () => {
            native = {
                cover: timelineOf(coverEl),
                enter: timelineOf(enterEl),
                page: timelineOf(document.querySelector<HTMLElement>('[data-testid="page-box"]'))
            }
        }
        // Native animations attach a few frames after mount.
        const timer = setTimeout(read, 400)
        window.addEventListener('scroll', read, { passive: true })
        return () => {
            clearTimeout(timer)
            window.removeEventListener('scroll', read)
        }
    })

    const allGood = $derived(
        native.cover === 'ViewTimeline' &&
            native.enter === 'ViewTimeline' &&
            native.page === 'none (JS)'
    )

    const steps: TesterStep[] = [
        {
            text: 'Scroll down slowly until the blue "in view" box has fully passed the top of the window.',
            expected:
                'It fades in from 20% as it enters from the bottom and keeps brightening until it leaves at the top.'
        },
        {
            text: 'Keep scrolling past the green "enter" box.',
            expected: 'It fades in only while it enters from the bottom, then stays fully visible.'
        },
        {
            text: 'Check the readout above.',
            expected:
                'In view and Enter are driven by ViewTimeline. The page-offset box (fixed, bottom left) says "none (JS)". The chip reads NATIVE ✓.'
        }
    ]
</script>

<svelte:head>
    <title>useScroll ViewTimeline offsets</title>
</svelte:head>

<main class="vt-offsets">
    <header class="intro">
        <p class="kicker">useScroll · ViewTimeline offsets</p>
        <h1>Scroll down.</h1>
        <p>Each box's opacity follows its own scroll progress.</p>
    </header>

    <div class="spacer"></div>

    <motion.div
        bind:ref={coverEl}
        data-testid="cover-box"
        class="box cover"
        style={{ opacity: coverOpacity }}
    >
        in view<br /><small>["start end", "end start"]</small>
    </motion.div>

    <div class="spacer"></div>

    <motion.div
        bind:ref={enterEl}
        data-testid="enter-box"
        class="box enter"
        style={{ opacity: enterOpacity }}
    >
        enter<br /><small>["start end", "end end"]</small>
    </motion.div>

    <div class="spacer"></div>
    <div class="spacer"></div>

    <motion.div data-testid="page-box" class="box page" style={{ opacity: pageOpacity }}>
        page offset<br /><small>no target</small>
    </motion.div>

    <div class="readouts">
        <p>
            in view accelerated: <span data-testid="cover-accelerated"
                >{String(!!cover.scrollYProgress.accelerate)}</span
            >
        </p>
        <p>
            enter accelerated: <span data-testid="enter-accelerated"
                >{String(!!enter.scrollYProgress.accelerate)}</span
            >
        </p>
        <p>
            page offset accelerated: <span data-testid="page-accelerated"
                >{String(!!pageOffset.scrollYProgress.accelerate)}</span
            >
        </p>
    </div>
</main>

<TesterPanel
    eyebrow="useScroll · ViewTimeline offsets"
    title="Element offsets should run natively; page offsets on the main thread"
    status="Needs Motion 13.4.7+ and a browser with ViewTimeline (Chrome/Edge, recent Safari)."
    {steps}
>
    {#snippet summary()}
        {#if !supported}
            <span class="verdict na">NO VIEWTIMELINE</span>
        {:else if allGood}
            <span class="verdict ok">NATIVE ✓</span>
        {:else}
            <span class="verdict bad">NOT NATIVE ✗</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            When a scroll animation follows an element (a <code>target</code>), the browser can run
            it natively, which stays smooth even when the page is busy. The "in view" range only
            became native in Motion 13.4.7.
        </p>
        <p>
            A page-wide scroll with an <code>offset</code> can't run natively, so it must stay on the
            JavaScript path.
        </p>
    {/snippet}
    {#if isTester}
        <p class="detail">In view: <strong>{native.cover ?? '–'}</strong></p>
        <p class="detail">Enter: <strong>{native.enter ?? '–'}</strong></p>
        <p class="detail">Page offset: <strong>{native.page ?? '–'}</strong></p>
    {/if}
</TesterPanel>

<style>
    /*
     * The test app's global app.css sets `overflow-y: auto !important` on both
     * html and body, which makes body a scroll container that never scrolls.
     * A ViewTimeline follows its subject's nearest scroll container, so every
     * native animation here would freeze. Restore normal document scrolling
     * while this page is mounted. Upstream Motion has the same dependency on
     * page CSS; it is not a library defect.
     */
    :global(html:has(main.vt-offsets)),
    :global(html:has(main.vt-offsets) body) {
        overflow-y: visible !important;
    }
    main {
        padding: 2rem;
    }
    .intro h1 {
        font-size: 2rem;
        font-weight: 700;
    }
    .spacer {
        height: 100vh;
    }
    :global(.box) {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 18rem;
        height: 12rem;
        margin: 0 auto;
        border-radius: 0.75rem;
        color: white;
        font-weight: 600;
        text-align: center;
    }
    :global(.box small) {
        font-weight: 400;
        opacity: 0.8;
    }
    :global(.box.cover) {
        background: #2563eb;
    }
    :global(.box.enter) {
        background: #10b981;
    }
    :global(.box.page) {
        position: fixed;
        bottom: 1rem;
        left: 1rem;
        width: 10rem;
        height: 6rem;
        margin: 0;
        background: #8b5cf6;
    }
    .readouts {
        position: fixed;
        top: 1rem;
        left: 1rem;
        font-size: 0.85rem;
    }
    .verdict {
        display: inline-block;
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
    .detail {
        font-size: 0.8rem;
        margin: 0.35rem 0;
    }
</style>
