<script lang="ts">
    import { motion, useScroll, useTransform } from '$lib'
    import { flushSync, onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Mirrors motion's dev/react/src/tests/scroll-accelerate.tsx.
    // useTransform(scrollYProgress, [range], [output]) should run as a native
    // ScrollTimeline animation (compositor thread) when the browser supports it.
    const { scrollYProgress } = useScroll()

    // motion#3857 case: partial input range must hold its end values.
    const partialOpacity = useTransform(scrollYProgress, [0.25, 0.5], [0.2, 1])

    // Direct, first-hop transforms: accelerated.
    const directOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0])
    const directBackground = useTransform(scrollYProgress, [0, 1], ['#ff0000', '#0000ff'])

    // Chained transform: deliberately NOT accelerated (JS path).
    const intermediate = useTransform(scrollYProgress, [0, 1], [1, 0.5])
    const chainedOpacity = useTransform(intermediate, [1, 0.75], [0, 1])

    // Descending range: guard keeps it on the JS path (element.animate would throw).
    const descendingOpacity = useTransform(scrollYProgress, [1, 0], [0, 1])

    // ---- Main-thread block with a compositor-driven countdown ----
    //
    // While the busy loop runs, no JavaScript (and no Svelte update) can run,
    // so an interval-based countdown would freeze with everything else. The
    // countdown is therefore two WAAPI animations of compositor-only
    // properties: a `transform: scaleX` bar and stepped `opacity` digits. They
    // keep ticking during the block, which also proves the block is real.

    /** How long the main thread is blocked, in seconds. */
    const BLOCK_SECONDS = 3
    /** Lead-in before the block, so the tester can get ready to scroll. */
    const LEAD_IN_SECONDS = 3

    let phase = $state<'idle' | 'lead-in' | 'blocking' | 'done'>('idle')
    let leadIn = $state(LEAD_IN_SECONDS)
    let bar = $state<HTMLElement | null>(null)
    const digits: HTMLElement[] = []

    /**
     * Keyframes that show digit `index` (of `count`) only during its own
     * second of the countdown. Opacity jumps are made with duplicate offsets.
     *
     * @param index Position in the countdown (0 shows first).
     * @param count Total number of digits.
     * @returns WAAPI keyframes for that digit's opacity.
     */
    const digitKeyframes = (index: number, count: number): Keyframe[] => {
        const start = index / count
        const end = (index + 1) / count
        const frames: Keyframe[] = []
        if (index > 0) frames.push({ opacity: 0, offset: 0 }, { opacity: 0, offset: start })
        frames.push({ opacity: 1, offset: start }, { opacity: 1, offset: end })
        if (index < count - 1) frames.push({ opacity: 0, offset: end }, { opacity: 0, offset: 1 })
        return frames
    }

    /** Resolves after the next two frames, so started animations reach the compositor. */
    const afterPaint = () =>
        new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )

    const runBlock = async () => {
        // Write the "blocking" UI to the DOM now, before the loop starts.
        flushSync(() => (phase = 'blocking'))
        const duration = BLOCK_SECONDS * 1000
        bar?.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
            duration,
            easing: 'linear',
            fill: 'forwards'
        })
        digits.forEach((digit, index) =>
            digit.animate(digitKeyframes(index, digits.length), { duration, easing: 'linear' })
        )
        await afterPaint()

        const end = performance.now() + duration
        while (performance.now() < end) {
            // Intentionally blocking the main thread.
        }
        phase = 'done'
    }

    const startBlock = () => {
        if (phase === 'lead-in' || phase === 'blocking') return
        phase = 'lead-in'
        leadIn = LEAD_IN_SECONDS
        const tick = () => {
            leadIn -= 1
            if (leadIn > 0) setTimeout(tick, 1000)
            else void runBlock()
        }
        setTimeout(tick, 1000)
    }

    // ---- Live verdict for the #3857 end-value hold (tester only) ----

    let isTester = $state(false)
    let supported = $state(false)
    let nativeOffsets = $state<number[] | null>(null)
    let computedOpacity = $state<number | null>(null)
    let expectedOpacity = $state<number | null>(null)
    let partialElement = $state<HTMLElement | null>(null)

    /** What `partial` must show at scroll progress `p` (clamped mapping). */
    const expectedPartial = (p: number) => {
        if (p <= 0.25) return 0.2
        if (p >= 0.5) return 1
        return 0.2 + ((p - 0.25) / 0.25) * 0.8
    }

    const PADDED = [0, 0.25, 0.5, 1]
    const keyframesOk = $derived(
        nativeOffsets !== null &&
            nativeOffsets.length === PADDED.length &&
            nativeOffsets.every((offset, i) => Math.abs(offset - PADDED[i]) < 1e-6)
    )
    const opacityOk = $derived(
        computedOpacity !== null &&
            expectedOpacity !== null &&
            Math.abs(computedOpacity - expectedOpacity) < 0.03
    )
    const verdict = $derived(
        !supported ? 'unsupported' : keyframesOk && opacityOk ? 'holds' : 'broken'
    )

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        supported = 'ScrollTimeline' in window

        let frame = 0
        const measure = () => {
            frame = 0
            const el = partialElement
            if (!el) return
            const scrollable = document.documentElement.scrollHeight - window.innerHeight
            const progress = scrollable > 0 ? window.scrollY / scrollable : 0
            expectedOpacity = expectedPartial(progress)
            computedOpacity = Number(getComputedStyle(el).opacity)
            const native = el
                .getAnimations()
                .find((a) => a.timeline?.constructor?.name === 'ScrollTimeline')
            const frames = (native?.effect as KeyframeEffect | undefined)?.getKeyframes()
            nativeOffsets = frames ? frames.map((f) => Number(f.offset)) : null
        }
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(measure)
        }
        // The native animation attaches a few frames after mount.
        const settle = setTimeout(measure, 300)
        window.addEventListener('scroll', schedule, { passive: true })
        return () => {
            clearTimeout(settle)
            cancelAnimationFrame(frame)
            window.removeEventListener('scroll', schedule)
        }
    })

    const steps: TesterStep[] = [
        {
            text: 'Scroll slowly from the top to the bottom of the page. Watch the green "partial" box.',
            expected:
                'It holds at 20% opacity until a quarter of the way down, fades in until half way, then stays fully opaque to the bottom. It must not snap back. The chip above reads HOLDS ✓ the whole way.'
        },
        {
            text: 'Scroll to about a third of the way down (the orange "chained" box is visible there). Press "Block main thread", then put your hand on the scroll wheel during the 3-second lead-in.',
            expected:
                'The status changes to "Main thread BLOCKED", with a draining bar and a 3-2-1 countdown that keep moving.'
        },
        {
            text: 'While the bar drains, scroll up and down.',
            expected:
                'The accelerated boxes ("partial", "direct") keep fading with your scroll. The JS boxes ("chained", "descending") freeze until the countdown ends, then jump to catch up.'
        }
    ]
</script>

<svelte:head>
    <title>useTransform scroll acceleration</title>
</svelte:head>

<main>
    <div class="fixtures">
        <figure>
            <motion.div
                data-testid="partial"
                class="box"
                bind:ref={partialElement}
                style={{ opacity: partialOpacity, background: '#10b981' }}>partial</motion.div
            >
            <figcaption>native</figcaption>
        </figure>
        <figure>
            <motion.div
                data-testid="direct"
                class="box"
                style={{ opacity: directOpacity, backgroundColor: directBackground }}
                >direct</motion.div
            >
            <figcaption>native</figcaption>
        </figure>
        <figure>
            <motion.div
                data-testid="chained"
                class="box"
                style={{ opacity: chainedOpacity, background: '#f59e0b' }}>chained</motion.div
            >
            <figcaption>JS · invisible at the top, fades in as you scroll</figcaption>
        </figure>
        <figure>
            <motion.div
                data-testid="descending"
                class="box"
                style={{ opacity: descendingOpacity, background: '#8b5cf6' }}>descending</motion.div
            >
            <figcaption>JS</figcaption>
        </figure>
    </div>

    <div class="readouts">
        <p>
            partial accelerated: <span data-testid="partial-accelerated"
                >{String(!!partialOpacity.accelerate)}</span
            >
        </p>
        <p>
            direct accelerated: <span data-testid="direct-accelerated"
                >{String(!!directOpacity.accelerate)}</span
            >
        </p>
        <p>
            bg accelerated: <span data-testid="bg-accelerated"
                >{String(!!directBackground.accelerate)}</span
            >
        </p>
        <p>
            chained accelerated: <span data-testid="chained-accelerated"
                >{String(!!chainedOpacity.accelerate)}</span
            >
        </p>
        <p>
            descending accelerated: <span data-testid="descending-accelerated"
                >{String(!!descendingOpacity.accelerate)}</span
            >
        </p>

        <div class="blocker">
            <button
                type="button"
                class="block-button"
                data-testid="block-main-thread"
                disabled={phase === 'lead-in' || phase === 'blocking'}
                onclick={startBlock}
            >
                Block main thread ({BLOCK_SECONDS}s)
            </button>

            <div class="status" class:active={phase === 'blocking'}>
                {#if phase === 'idle'}
                    Main thread free.
                {:else if phase === 'lead-in'}
                    Blocking in <strong>{leadIn}</strong>… get ready to scroll.
                {:else if phase === 'blocking'}
                    <strong>Main thread BLOCKED</strong>: scroll now.
                {:else}
                    Done. Main thread free again. Did "partial" and "direct" keep moving while
                    "chained" and "descending" froze?
                {/if}
            </div>

            <!-- Always rendered, so the compositor animations have targets. -->
            <div class="countdown" class:visible={phase === 'blocking'} aria-hidden="true">
                <div class="track"><div class="bar" bind:this={bar}></div></div>
                <div class="digits">
                    {#each Array.from({ length: BLOCK_SECONDS }, (_, i) => BLOCK_SECONDS - i) as seconds, index (seconds)}
                        <span bind:this={digits[index]}>{seconds}s</span>
                    {/each}
                </div>
            </div>
        </div>
    </div>

    <div class="spacer"></div>
    <div class="spacer"></div>
    <div class="spacer"></div>
    <div class="spacer"></div>
</main>

<TesterPanel
    eyebrow="useTransform scroll acceleration"
    title="Scroll-driven fades should run natively and hold their end values"
    status="Needs a browser with ScrollTimeline (Chrome/Edge, recent Safari)."
    {steps}
>
    {#snippet summary()}
        {#if verdict === 'holds'}
            <span class="verdict ok">HOLDS ✓</span>
        {:else if verdict === 'broken'}
            <span class="verdict bad">SNAPS BACK ✗</span>
        {:else}
            <span class="verdict na">NO SCROLLTIMELINE</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            Fades tied to scroll position should keep moving even when the page is busy, because the
            browser drives them natively. Chained and descending ranges use the slower JavaScript
            path on purpose.
        </p>
        <p>
            The green box only fades between a quarter and half of the way down. Past half way it
            must stay fully visible (an upstream bug made it snap back).
        </p>
    {/snippet}
    {#if isTester}
        <p class="detail">
            Green box opacity: <strong>{computedOpacity?.toFixed(2) ?? '–'}</strong>, expected
            <strong>{expectedOpacity?.toFixed(2) ?? '–'}</strong>
            <span class:bad-text={!opacityOk}>{opacityOk ? '✓' : '✗'}</span>
        </p>
        <p class="detail">
            Native keyframe offsets: <code>{nativeOffsets ? nativeOffsets.join(', ') : 'none'}</code
            >
            <span class:bad-text={!keyframesOk}
                >{keyframesOk ? '✓ padded' : '✗ expected 0, 0.25, 0.5, 1'}</span
            >
        </p>
    {/if}
</TesterPanel>

<style>
    .fixtures {
        position: fixed;
        top: 1rem;
        left: 1rem;
        display: flex;
        gap: 1rem;
        z-index: 10;
    }
    figure {
        margin: 0;
        width: 7rem;
    }
    figcaption {
        margin-top: 0.35rem;
        font-size: 0.7rem;
        color: #64748b;
        line-height: 1.2;
    }
    .fixtures :global(.box) {
        width: 7rem;
        height: 7rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.5rem;
        color: white;
        font-size: 0.8rem;
    }
    .readouts {
        position: fixed;
        top: 12rem;
        left: 1rem;
        z-index: 10;
        font-size: 0.85rem;
    }
    .blocker {
        margin-top: 1rem;
        width: 22rem;
    }
    .block-button {
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        background: #0f172a;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
    .block-button:hover:not(:disabled) {
        background: #334155;
    }
    .block-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .status {
        margin-top: 0.6rem;
        padding: 0.5rem 0.75rem;
        border-radius: 0.5rem;
        background: #f1f5f9;
    }
    .status.active {
        background: #fee2e2;
        color: #991b1b;
    }
    .countdown {
        margin-top: 0.6rem;
        visibility: hidden;
    }
    .countdown.visible {
        visibility: visible;
    }
    .track {
        height: 0.6rem;
        border-radius: 999px;
        background: #fecaca;
        overflow: hidden;
    }
    .bar {
        height: 100%;
        background: #dc2626;
        transform-origin: left center;
    }
    .digits {
        position: relative;
        height: 2.2rem;
        margin-top: 0.4rem;
    }
    .digits span {
        position: absolute;
        left: 0;
        font-size: 1.8rem;
        font-weight: 700;
        color: #991b1b;
        opacity: 0;
    }
    .spacer {
        height: 100vh;
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
    .bad-text {
        color: #b91c1c;
        font-weight: 600;
    }
</style>
