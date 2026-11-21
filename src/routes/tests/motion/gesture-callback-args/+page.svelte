<script lang="ts">
    import { motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Gesture callbacks receive Motion's arguments (plan 014): hover and tap
    // get `(event, info)` with `info.point` the page position, and the
    // viewport callbacks get the IntersectionObserverEntry. Upstream
    // `framer-motion/src/gestures/hover.ts`, `gestures/press.ts` and
    // `motion/features/viewport/index.ts` at v14.14.0.

    let hoverStart = $state('none')
    let hoverEnd = $state('none')
    let tapStart = $state('none')
    let tap = $state('none')
    let viewportEnter = $state('none')
    let aliasStarts = $state(0)

    /** Format an event and its page point as `"<type> x,y"`. */
    const formatEvent = (event: Event, info: { point: { x: number; y: number } }) =>
        `${event.type} ${Math.round(info.point.x)},${Math.round(info.point.y)}`

    const steps: TesterStep[] = [
        {
            text: 'Hover the box and move away.',
            expected: "Hover start and end show the event type and your pointer's page position."
        },
        {
            text: 'Click the button.',
            expected:
                'Tap start shows pointerdown, tap shows pointerup, both with the click position.'
        },
        {
            text: 'Load the page.',
            expected: 'Viewport enter reads "true in-view-box", alias starts reads 1.'
        }
    ]
</script>

<svelte:head>
    <title>Gesture callback arguments</title>
</svelte:head>

<main class="gesture-callback-args">
    <section>
        <motion.div
            data-testid="hover-box"
            class="target"
            style="background-color: #e11d48;"
            whileHover={{ scale: 1.1 }}
            onHoverStart={(event, info) => {
                hoverStart = formatEvent(event, info)
            }}
            onHoverEnd={(event, info) => {
                hoverEnd = formatEvent(event, info)
            }}
        >
            Hover
        </motion.div>
        <p>start: <strong data-testid="hover-start">{hoverStart}</strong></p>
        <p>end: <strong data-testid="hover-end">{hoverEnd}</strong></p>
    </section>

    <section>
        <motion.button
            data-testid="tap-box"
            class="target"
            style="background-color: #7c3aed;"
            whileTap={{ scale: 0.9 }}
            onTapStart={(event, info) => {
                tapStart = formatEvent(event, info)
            }}
            onTap={(event, info) => {
                tap = formatEvent(event, info)
            }}
        >
            Tap
        </motion.button>
        <p>start: <strong data-testid="tap-start">{tapStart}</strong></p>
        <p>tap: <strong data-testid="tap">{tap}</strong></p>
    </section>

    <section>
        <motion.div
            data-testid="in-view-box"
            class="target"
            style="background-color: #22aa66;"
            initial={{ opacity: 0.2 }}
            whileInView={{ opacity: 1 }}
            onViewportEnter={(entry) => {
                viewportEnter = `${entry?.isIntersecting} ${(entry?.target as HTMLElement | undefined)?.dataset.testid}`
            }}
            onInViewStart={() => aliasStarts++}
        >
            In view
        </motion.div>
        <p>enter: <strong data-testid="viewport-enter">{viewportEnter}</strong></p>
        <p>alias starts: <strong data-testid="alias-starts">{aliasStarts}</strong></p>
    </section>
</main>

<TesterPanel
    eyebrow="gestures/hover.ts, press.ts, viewport/index.ts"
    title="Gesture callback arguments"
    {steps}
>
    {#snippet checks()}
        <p>
            <code>onHoverStart</code>, <code>onHoverEnd</code>, <code>onTapStart</code> and
            <code>onTap</code> receive <code>(event, info)</code>. <code>onViewportEnter</code>
            receives the IntersectionObserver entry, and <code>onInViewStart</code> still fires as an
            alias.
        </p>
    {/snippet}
</TesterPanel>

<style>
    main {
        display: flex;
        flex-wrap: wrap;
        gap: 2rem;
        padding: 2rem;
    }
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    p {
        margin: 0;
    }
    :global(.gesture-callback-args .target) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 120px;
        border: none;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
</style>
