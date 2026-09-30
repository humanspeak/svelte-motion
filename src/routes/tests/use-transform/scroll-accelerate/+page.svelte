<script lang="ts">
    import { motion, useScroll, useTransform } from '$lib'
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

    /** Busy-loops the main thread for ~2 seconds. */
    const blockMainThread = () => {
        const end = performance.now() + 2000
        while (performance.now() < end) {
            // Intentionally blocking.
        }
    }

    const steps: TesterStep[] = [
        {
            text: 'Scroll slowly from the top of the page. Watch the "partial" box.',
            expected:
                'It holds at 20% opacity until a quarter of the way down, fades in until half way, then stays fully opaque to the bottom. It must not snap back.'
        },
        {
            text: 'Scroll back to the top, press "Block main thread", and immediately scroll.',
            expected:
                'The accelerated boxes (partial, direct) keep fading while the page is blocked. The chained and descending boxes freeze until the block ends.'
        }
    ]
</script>

<svelte:head>
    <title>useTransform scroll acceleration</title>
</svelte:head>

<main>
    <div class="fixtures">
        <motion.div
            data-testid="partial"
            class="box"
            style={{ opacity: partialOpacity, background: '#10b981' }}>partial</motion.div
        >
        <motion.div
            data-testid="direct"
            class="box"
            style={{ opacity: directOpacity, backgroundColor: directBackground }}>direct</motion.div
        >
        <motion.div
            data-testid="chained"
            class="box"
            style={{ opacity: chainedOpacity, background: '#f59e0b' }}>chained</motion.div
        >
        <motion.div
            data-testid="descending"
            class="box"
            style={{ opacity: descendingOpacity, background: '#8b5cf6' }}>descending</motion.div
        >
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
        <button data-testid="block-main-thread" onclick={blockMainThread}>Block main thread</button>
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
    {#snippet checks()}
        <p>
            Fades tied to scroll position should keep moving even when the page is busy, because the
            browser drives them natively. Chained and descending ranges use the slower JavaScript
            path on purpose.
        </p>
    {/snippet}
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
        top: 10rem;
        left: 1rem;
        z-index: 10;
        font-size: 0.85rem;
    }
    .spacer {
        height: 100vh;
    }
</style>
