<script lang="ts">
    import { motion } from '$lib'

    // Regression test for #353 — nested `layoutScroll` containers.
    //
    // Outer scroll container with `layoutScroll`. Inside it, an inner
    // scroll container also with `layoutScroll`. Inside that, the
    // animating `layout` motion.div.
    //
    // Click "Resize". While the box is animating, scroll the OUTER
    // container. With the chain-walking fix, the FLIP delta cancels out
    // the outer scroll (just like it already did for the inner). Without
    // the fix, only the inner container's scroll was accounted for and
    // the outer scroll showed up as drift.

    let expanded = $state(false)
    function toggle() {
        expanded = !expanded
    }
</script>

<svelte:head>
    <title>nested layoutScroll · regression test</title>
</svelte:head>

<div class="page" data-testid="nested-layout-scroll-page">
    <header>
        <h1>Nested <code>layoutScroll</code> containers</h1>
        <p>
            An outer scroll container with <code>layoutScroll</code>, an inner one also with
            <code>layoutScroll</code>, and a <code>layout</code> box inside.
        </p>
        <p>
            Click <strong>Resize</strong> then scroll the <strong>outer</strong> container while the box
            is animating. The box should stay anchored — both ancestors' scroll offsets are summed when
            computing the FLIP delta.
        </p>
        <button data-testid="toggle" type="button" onclick={toggle}>
            Resize box → {expanded ? 'shrink' : 'expand'}
        </button>
    </header>

    <motion.div
        layoutScroll
        data-testid="outer"
        style="overflow: auto; height: 380px; border: 2px solid #f59e0b; border-radius: 8px; background: #fff7ed; position: relative; margin-top: 16px;"
    >
        <div style="height: 80px; padding: 8px 12px; color: #92400e; font-size: 0.78rem;">
            <strong>outer</strong> · <code>layoutScroll</code> · #f59e0b border
        </div>
        <motion.div
            layoutScroll
            data-testid="inner"
            style="overflow: auto; height: 280px; margin: 0 16px; border: 2px solid #06b6d4; border-radius: 8px; background: #ecfeff; position: relative;"
        >
            <div style="height: 60px; padding: 8px 12px; color: #155e75; font-size: 0.78rem;">
                <strong>inner</strong> · <code>layoutScroll</code> · #06b6d4 border
            </div>
            <motion.div
                data-testid="box"
                layout
                transition={{ duration: 1.8, ease: 'easeInOut' }}
                style="width: {expanded ? '220px' : '120px'}; height: {expanded
                    ? '220px'
                    : '120px'}; border-radius: 12px; background: linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%); margin: 0 auto;"
            ></motion.div>
            <div style="height: 420px;"></div>
        </motion.div>
        <div style="height: 220px;"></div>
    </motion.div>
</div>

<style>
    .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 24px;
        font-family: ui-sans-serif, system-ui, sans-serif;
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
</style>
