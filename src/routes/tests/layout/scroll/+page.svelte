<script lang="ts">
    import { motion } from '$lib'

    // Regression test for the `layoutScroll` prop.
    //
    // Two side-by-side scroll containers, each with the same FLIP layout
    // animation inside. The right one has `layoutScroll` on the container;
    // the left one doesn't.
    //
    // Click "Resize" to grow the inner element. Then scroll either container
    // mid-animation. The container without `layoutScroll` will drift (FLIP
    // measures viewport-relative rects, so the scroll offset shows up as
    // extra movement). The container with `layoutScroll` stays anchored —
    // measurements happen in the container's coordinate space.
    //
    // Playwright e2e drives this exact scenario.

    let expanded = $state(false)
    function toggle() {
        expanded = !expanded
    }

    const sizeRest = '120px'
    const sizeExpanded = '240px'

    // Svelte's scope hash is added to native elements but not to `motion.*`
    // components, so a shared `.scroll` class wouldn't apply to both
    // panels. Inline the style on both panels for parity instead.
    const scrollPanelStyle =
        'overflow: auto; height: 320px; border: 1px solid #bbb; border-radius: 8px; background: #fafafa; position: relative;'
</script>

<svelte:head>
    <title>layout + layoutScroll · regression test</title>
</svelte:head>

<div class="page" data-testid="layout-scroll-page">
    <header>
        <h1>
            <code>layout</code> +
            <code>layoutScroll</code> regression test
        </h1>
        <p>
            Each panel is an <code>overflow: auto</code> scroll container with the same FLIP
            animation inside. The right panel has <code>layoutScroll</code> on the container; the left
            does not.
        </p>
        <p>
            Click <strong>Resize box</strong> to fire a layout animation. During the animation, scroll
            either panel — the left one drifts, the right one stays anchored.
        </p>
        <button data-testid="toggle" type="button" onclick={toggle}>
            Resize box → {expanded ? 'shrink' : 'expand'}
        </button>
    </header>

    <section class="panels">
        <article class="panel">
            <h2>
                without <code>layoutScroll</code>
                <span class="bad">drifts on scroll</span>
            </h2>
            <div style={scrollPanelStyle} data-testid="scroll-without">
                <div class="pad-top"></div>
                <motion.div
                    data-testid="box-without"
                    layout
                    transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                    style="width: {expanded ? sizeExpanded : sizeRest}; height: {expanded
                        ? sizeExpanded
                        : sizeRest}; border-radius: 12px; background: linear-gradient(135deg,#ef4444 0%,#f97316 100%); margin: 0 auto;"
                ></motion.div>
                <div class="pad-bottom"></div>
            </div>
        </article>

        <article class="panel">
            <h2>
                with <code>layoutScroll</code>
                <span class="good">stays anchored</span>
            </h2>
            <motion.div layoutScroll data-testid="scroll-with" style={scrollPanelStyle}>
                <div class="pad-top"></div>
                <motion.div
                    data-testid="box-with"
                    layout
                    transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                    style="width: {expanded ? sizeExpanded : sizeRest}; height: {expanded
                        ? sizeExpanded
                        : sizeRest}; border-radius: 12px; background: linear-gradient(135deg,#22c55e 0%,#06b6d4 100%); margin: 0 auto;"
                ></motion.div>
                <div class="pad-bottom"></div>
            </motion.div>
        </article>
    </section>
</div>

<style>
    .page {
        max-width: 920px;
        margin: 0 auto;
        padding: 24px;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    header {
        margin-bottom: 16px;
    }
    h1 {
        font-size: 1.4rem;
        margin: 0 0 0.5rem;
    }
    p {
        color: #444;
        line-height: 1.5;
        margin: 0 0 0.5rem;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 0.85em;
        background: #f3f3f3;
        padding: 0 4px;
        border-radius: 3px;
    }
    button {
        margin-top: 8px;
        padding: 0.5rem 1rem;
        background: #111;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    }
    .panels {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 16px;
    }
    .panel h2 {
        font-size: 1rem;
        margin: 0 0 0.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .panel h2 span {
        font-size: 0.72rem;
        font-weight: 400;
        padding: 2px 6px;
        border-radius: 4px;
    }
    .bad {
        color: #b91c1c;
        background: #fee2e2;
    }
    .good {
        color: #047857;
        background: #d1fae5;
    }
    .pad-top {
        height: 360px;
        background: linear-gradient(to bottom, #f3f3f3, transparent);
    }
    .pad-bottom {
        height: 360px;
        background: linear-gradient(to top, #f3f3f3, transparent);
    }
</style>
