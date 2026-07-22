<script lang="ts">
    /**
     * Characterization page for `layout` FLIP driven by the motion element's
     * OWN `class` prop. Clicking the toggle swaps the ball's class between
     * `ball` and `ball shift`; the `shift` class moves the ball 200px to the
     * right via `margin-left`, changing the element's own layout box.
     *
     * A class change on the element is watched by BOTH delivery paths: the
     * Svelte-reactive path (`classProp` is a tracked layout dependency) AND the
     * DOM self-attribute observer (its `attributeFilter` includes `class`).
     * Upstream framer-motion guarantees exactly one measure/animate pass per
     * commit; this page counts `onProjectionUpdate` events with
     * `hasLayoutChanged === true` so the double-commit stutter is measurable
     * without opening DevTools.
     *
     * @component
     */
    import { motion, styleString, type MotionTransition, type ProjectionUpdatePayload } from '$lib'

    type ProjectionEvent = { changed: boolean; at: number }

    let shifted = $state(false)

    // Tween (no overshoot) keeps a clean FLIP monotonic: the element's left
    // edge should increase strictly as it slides into the shifted slot. A
    // duplicate reactive re-commit restarts the FLIP from origin, which shows
    // up as a backwards jump in the sampled `left` series.
    const transition: MotionTransition = { duration: 0.6, ease: 'easeOut' }

    const recordProjection = (data: ProjectionUpdatePayload) => {
        const store = window as unknown as { __projectionEvents?: ProjectionEvent[] }
        ;(store.__projectionEvents ??= []).push({
            changed: data.hasLayoutChanged,
            at: performance.now()
        })
    }
</script>

<svelte:head>
    <title>Motion · layout FLIP on own class toggle</title>
</svelte:head>

<main data-testid="layout-class-toggle">
    <h1>layout FLIP on own class toggle</h1>

    <button data-testid="class-toggle" type="button" onclick={() => (shifted = !shifted)}>
        toggle
    </button>

    <div
        class="track"
        style={styleString(() => ({
            width: '360px',
            height: '80px',
            border: '1px solid #4ff0b7',
            background: 'rgba(79, 240, 183, 0.08)'
        }))}
    >
        <motion.div
            data-testid="class-toggle-ball"
            layout
            class={shifted ? 'ball shift' : 'ball'}
            {transition}
            onProjectionUpdate={recordProjection}
        ></motion.div>
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

    /* The ball's own class drives its layout position. Scoped through the
       page's data-testid so the motion element's forwarded class matches. */
    :global([data-testid='layout-class-toggle'] .ball) {
        width: 60px;
        height: 60px;
        background: #4ff0b7;
        margin-left: 0;
    }

    :global([data-testid='layout-class-toggle'] .ball.shift) {
        margin-left: 200px;
    }
</style>
