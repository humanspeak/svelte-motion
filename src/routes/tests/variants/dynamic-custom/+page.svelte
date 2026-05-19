<script lang="ts">
    import { motion, type Variants } from '$lib'

    // Regression test for the bug where changing `custom` while the variant
    // key stays the same (e.g. `animate="visible"`) failed to re-animate —
    // because the ready-state animate effects gated on `lastRanVariantKey`
    // (a string) and ignored the resolved keyframes derived from `custom`.
    //
    // Expected behaviour after the fix:
    //   - Box reads `data-x={`<latest x value computed from custom>`}`
    //   - Clicking "increment custom" steps custom by 1
    //   - The function-form variant `visible: (i) => ({ x: i * 50 })`
    //     re-resolves, the effect re-runs, and the element animates to
    //     x = custom * 50 each time.
    //
    // Before the fix, clicking the button updated the `custom` counter but
    // the box stayed pinned at x=0 forever (no re-animation).

    let customValue = $state(0)

    const variants: Variants = {
        visible: (i) => ({ x: (i as number) * 50, opacity: 1 })
    }

    const expectedX = $derived(customValue * 50)
</script>

<svelte:head>
    <title>Variants — dynamic custom (regression test)</title>
</svelte:head>

<div class="page" data-testid="dynamic-custom-page">
    <header>
        <h1>Dynamic variants — reactive <code>custom</code></h1>
        <p>
            Function-form variant <code>visible: (i) =&gt; (&lbrace; x: i * 50 &rbrace;)</code>. The
            <code>custom</code>
            prop drives <code>x</code> while
            <code>animate</code> stays at the string <code>"visible"</code> the whole time.
        </p>
        <p>
            Each click should animate the box to its new <code>x</code>. Before the fix that wired
            <code>effectiveCustom</code> into the animate-effect gating, the variant key didn't change
            so the effect short-circuited and the box never moved past x=0.
        </p>
    </header>

    <section class="controls">
        <button
            type="button"
            data-testid="increment"
            onclick={() => {
                customValue += 1
            }}
        >
            increment custom (currently {customValue}) →
        </button>
        <button
            type="button"
            data-testid="reset"
            onclick={() => {
                customValue = 0
            }}
        >
            reset
        </button>
    </section>

    <section class="stage">
        <div class="track">
            <motion.div
                custom={customValue}
                {variants}
                initial={{ x: 0, opacity: 1 }}
                animate="visible"
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                class="box"
                data-testid="box"
                data-custom={customValue}
                data-expected-x={expectedX}
            >
                custom = {customValue}
            </motion.div>
        </div>
    </section>

    <section class="readout">
        <div>
            <span class="k">custom</span>
            <strong data-testid="readout-custom">{customValue}</strong>
        </div>
        <div>
            <span class="k">expected x</span>
            <strong data-testid="readout-expected-x">{expectedX}</strong>
        </div>
    </section>

    <section class="howto">
        <p>
            <b>How to verify:</b> click the increment button. Each click should kick off a spring
            from the current resting x to <code>custom * 50</code>. After ~600&nbsp;ms the box
            should sit at the new position. If it stays glued to <code>translateX(0px)</code> no matter
            how many times you click, the bug is back.
        </p>
        <pre>// from the browser console:
const box = document.querySelector('[data-testid="box"]')
box.style.transform // expected: translateX(&lt;custom * 50&gt;px)
</pre>
    </section>
</div>

<style>
    .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 24px;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    header h1 {
        font-size: 1.5rem;
        margin: 0 0 0.5rem;
    }
    header p {
        color: #444;
        line-height: 1.5;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 0.85em;
        background: #f3f3f3;
        padding: 0 4px;
        border-radius: 3px;
    }
    .controls {
        display: flex;
        gap: 8px;
        margin: 16px 0;
    }
    .controls button {
        padding: 0.5rem 1rem;
        background: #111;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    }
    .controls button:hover {
        background: #333;
    }
    .stage {
        margin: 24px 0;
        padding: 24px 16px;
        border: 1px dashed #bbb;
        border-radius: 8px;
        background: #fafafa;
    }
    .track {
        position: relative;
        min-height: 80px;
    }
    .box {
        width: 120px;
        height: 80px;
        border-radius: 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-family: ui-monospace, monospace;
        font-size: 0.85rem;
    }
    .readout {
        margin-top: 24px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        font-family: ui-monospace, monospace;
        font-size: 0.85rem;
    }
    .howto {
        margin-top: 20px;
        padding: 12px 16px;
        background: #fff8e6;
        border: 1px solid #f0d68a;
        border-radius: 6px;
        font-size: 0.85rem;
        color: #6a4a00;
    }
    .howto pre {
        margin-top: 8px;
        background: #faf2d8;
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
        font-family: ui-monospace, monospace;
        font-size: 0.78rem;
    }
    .readout > div {
        padding: 8px 12px;
        background: #f3f3f3;
        border-radius: 6px;
    }
    .k {
        display: block;
        color: #777;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 2px;
    }
</style>
