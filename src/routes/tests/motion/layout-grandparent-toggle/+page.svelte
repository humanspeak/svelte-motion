<script lang="ts">
    /**
     * Characterization page for `layout` FLIP driven by a GRANDPARENT's
     * reactive inline-style change. The motion element sits inside a static
     * middle wrapper (its attributes never change) which sits inside a flex
     * grandparent. Clicking flips the GRANDPARENT's `align-items`
     * (flex-start ↔ flex-end); because the column flex cross-axis is
     * horizontal, the wrapper — and the ball inside it — re-slot across the
     * container's width with NO change to the ball's own box (fixed 60×60, so
     * no resize) and NO change to the middle wrapper's attributes.
     *
     * Upstream framer-motion measures the WHOLE projection tree on any tracked
     * update, so a style change on any ancestor that re-slots a layout element
     * animates. Our DOM-scoped observer must watch a bounded ancestor chain,
     * not just the immediate parent, or this grandparent re-slot snaps.
     *
     * @component
     */
    import { motion, styleString, type MotionTransition } from '$lib'

    let isEnd = $state(false)

    const transition: MotionTransition = { duration: 0.6, ease: 'easeOut' }
</script>

<svelte:head>
    <title>Motion · layout FLIP on grandparent align toggle</title>
</svelte:head>

<main data-testid="layout-grandparent-toggle">
    <h1>layout FLIP on grandparent align toggle</h1>

    <button data-testid="grandparent-toggle" type="button" onclick={() => (isEnd = !isEnd)}>
        toggle
    </button>

    <!-- Grandparent: the flex container whose align-items flips. -->
    <div
        data-testid="grandparent"
        style={styleString(() => ({
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isEnd ? 'flex-end' : 'flex-start',
            padding: '10px',
            border: '1px solid #4ff0b7',
            background: 'rgba(79, 240, 183, 0.08)'
        }))}
    >
        <!-- Static middle wrapper: fixed size, NO changing attributes. -->
        <div
            data-testid="middle-wrapper"
            style={styleString(() => ({
                width: '60px',
                height: '60px'
            }))}
        >
            <motion.div
                data-testid="grandparent-toggle-ball"
                layout
                {transition}
                style={styleString(() => ({
                    width: '60px',
                    height: '60px',
                    background: '#4ff0b7'
                }))}
            ></motion.div>
        </div>
    </div>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #07100f;
        color: #e8fffa;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    main {
        width: min(920px, calc(100% - 32px));
        margin: 0 auto;
        padding: 24px 0 48px;
    }

    button {
        margin-bottom: 16px;
        padding: 8px 16px;
        border: 1px solid #4ff0b7;
        background: rgba(79, 240, 183, 0.12);
        color: #e8fffa;
        cursor: pointer;
        font: inherit;
    }
</style>
