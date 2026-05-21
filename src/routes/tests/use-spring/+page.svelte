<script lang="ts">
    import { motion, useSpring, useTransform } from '$lib'

    // Path 1: scalar source + Svelte 5 reactive read via .current
    const x = useSpring(0, { stiffness: 220, damping: 18 })

    // Path 2: scalar source + legacy $store template syntax via .subscribe shim
    const y = useSpring(0, { stiffness: 220, damping: 18 })

    // Path 3: useTransform consumes the spring via .subscribe shim (function form)
    const blur = useTransform(() => `blur(${Math.abs($y) / 20}px)`, [y])

    // Path 4: unit-string spring
    const rotate = useSpring('0deg', { stiffness: 120, damping: 14 })

    const targets = [0, 100, 200, 300]
    let cursor = $state(0)
    let nextIdx = $derived((cursor + 1) % targets.length)
    let nextTarget = $derived(targets[nextIdx]!)

    const cycle = () => {
        cursor = nextIdx
        const next = targets[cursor]!
        x.set(next)
        y.set(next)
        rotate.set(`${next * 1.5}deg`)
    }
</script>

<svelte:head>
    <title>useSpring · live demo</title>
</svelte:head>

<div class="page">
    <div class="page-inner">
        <header>
            <h1>useSpring · live demo</h1>
            <p class="lede">
                Four call paths exercised on one page. Click <kbd>cycle</kbd>
                to fire all three springs at once.
            </p>
            <button data-testid="cycle" type="button" onclick={cycle}>
                cycle → {nextTarget}
            </button>
        </header>

        <!-- Panel 1: .current API -->
        <section>
            <div class="panel-head">
                <span class="badge badge-blue">Svelte 5</span>
                <h2>x.current</h2>
                <code class="readout"
                    >x.current = <b data-testid="x-current">{x.current.toFixed(2)}</b></code
                >
            </div>
            <p class="hint">
                Reactive read backed by <code>$state</code>. No <code>$</code> prefix, no subscribe.
            </p>
            <div class="track">
                <div class="track-rail"></div>
                {#each targets as t (t)}
                    <span
                        class="stop"
                        style="left: {t}px;"
                        class:active={cursor === targets.indexOf(t)}>{t}</span
                    >
                {/each}
                <motion.div
                    data-testid="x-box"
                    class="box blue"
                    style="transform: translateX({x.current}px);"
                >
                    .current
                </motion.div>
            </div>
        </section>

        <!-- Panel 2: legacy subscribe shim -->
        <section>
            <div class="panel-head">
                <span class="badge badge-pink">Svelte 4 compat</span>
                <h2>$y (auto-subscribe shim)</h2>
                <code class="readout">$y = <b data-testid="y-current">{$y.toFixed(2)}</b></code>
            </div>
            <p class="hint">
                Legacy <code>$store</code> syntax keeps working via the <code>.subscribe()</code> shim.
                Same value, different read path.
            </p>
            <div class="track">
                <div class="track-rail"></div>
                {#each targets as t (t)}
                    <span
                        class="stop"
                        style="left: {t}px;"
                        class:active={cursor === targets.indexOf(t)}>{t}</span
                    >
                {/each}
                <motion.div
                    data-testid="y-box"
                    class="box pink"
                    style="transform: translateX({$y}px); filter: {$blur};"
                >
                    $store
                </motion.div>
            </div>
            <p class="hint">
                Bonus: this box's <code>filter: {$blur}</code> is driven by
                <code>useTransform(() =&gt; …, [y])</code> — proves the function-form
                <code>useTransform</code> still composes with the new spring.
            </p>
        </section>

        <!-- Panel 3: unit-string spring -->
        <section>
            <div class="panel-head">
                <span class="badge badge-green">Unit string</span>
                <h2>rotate ("0deg" → "Ndeg")</h2>
                <code class="readout"
                    >rotate.current = <b data-testid="rotate-current">{rotate.current}</b></code
                >
            </div>
            <p class="hint">Strings with unit suffixes round-trip without parse drift.</p>
            <div class="track rotate-track">
                <motion.div
                    data-testid="rotate-box"
                    class="box green"
                    style="transform: rotate({rotate.current});"
                >
                    unit
                </motion.div>
            </div>
        </section>

        <footer>
            <h3>What this confirms</h3>
            <ul>
                <li><code>useSpring(0).current</code> — Svelte 5 reactive read ✓</li>
                <li>
                    <code>$spring</code> — legacy auto-subscribe via the <code>.subscribe()</code> shim
                    ✓
                </li>
                <li>
                    <code>useTransform(() =&gt; …, [spring])</code> — function-form composition still
                    works ✓
                </li>
                <li>
                    <code>useSpring('0deg')</code> — unit-string source preserved through animation ✓
                </li>
                <li>
                    Spring physics — overshoots target then settles (motion-dom <code
                        >attachFollow</code
                    >) ✓
                </li>
            </ul>
        </footer>
    </div>
</div>

<style>
    /* Global app.css locks html/body to overflow:hidden / height:100vh,
       so this page must own its own scroll container. */
    .page {
        height: 100vh;
        overflow-y: auto;
        background: #f7f7fb;
        color: #111827;
        font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            sans-serif;
        line-height: 1.55;
    }
    :global(.dark) .page {
        background: #0f0f1a;
        color: #f5f5fa;
    }
    .page-inner {
        max-width: 720px;
        margin: 0 auto;
        padding: 40px 32px 80px;
    }

    header {
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    :global(.dark) header {
        border-bottom-color: rgba(255, 255, 255, 0.08);
    }
    h1 {
        margin: 0 0 8px;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.01em;
    }
    .lede {
        margin: 0 0 16px;
        color: #4b5563;
    }
    :global(.dark) .lede {
        color: #9ca3af;
    }
    kbd {
        display: inline-block;
        padding: 1px 6px;
        background: #e5e7eb;
        border-radius: 4px;
        font: inherit;
        font-size: 12px;
        font-family: ui-monospace, monospace;
        color: #111827;
    }
    :global(.dark) kbd {
        background: #1f2937;
        color: #f5f5fa;
    }

    button {
        padding: 10px 18px;
        font: inherit;
        font-weight: 600;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        box-shadow:
            0 1px 0 rgba(0, 0, 0, 0.04),
            0 4px 12px rgba(37, 99, 235, 0.25);
        transition:
            background 120ms ease,
            transform 120ms ease;
    }
    button:hover {
        background: #1d4ed8;
    }
    button:active {
        transform: translateY(1px);
    }

    section {
        margin: 28px 0;
        padding: 24px;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 14px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    :global(.dark) section {
        background: #1a1a2e;
        border-color: rgba(255, 255, 255, 0.06);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .panel-head {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 4px;
    }
    .panel-head h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.005em;
    }
    .badge {
        display: inline-block;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-radius: 999px;
    }
    .badge-blue {
        background: #dbeafe;
        color: #1e40af;
    }
    .badge-pink {
        background: #fce7f3;
        color: #9d174d;
    }
    .badge-green {
        background: #d1fae5;
        color: #065f46;
    }
    :global(.dark) .badge-blue {
        background: rgba(59, 130, 246, 0.2);
        color: #93c5fd;
    }
    :global(.dark) .badge-pink {
        background: rgba(236, 72, 153, 0.2);
        color: #f9a8d4;
    }
    :global(.dark) .badge-green {
        background: rgba(16, 185, 129, 0.2);
        color: #6ee7b7;
    }

    .readout {
        margin-left: auto;
        padding: 4px 10px;
        background: #f3f4f6;
        border-radius: 6px;
        font-family: ui-monospace, monospace;
        font-size: 13px;
        min-width: 220px;
        text-align: right;
    }
    :global(.dark) .readout {
        background: #0f1729;
        color: #e0e0ec;
    }
    .readout b {
        color: #2563eb;
        font-weight: 700;
    }
    :global(.dark) .readout b {
        color: #93c5fd;
    }

    .hint {
        margin: 4px 0 16px;
        font-size: 13px;
        color: #6b7280;
    }
    :global(.dark) .hint {
        color: #9ca3af;
    }
    code {
        padding: 1px 5px;
        background: #f3f4f6;
        border-radius: 4px;
        font-family: ui-monospace, monospace;
        font-size: 0.9em;
    }
    :global(.dark) code {
        background: #0f1729;
        color: #e0e0ec;
    }

    .track {
        position: relative;
        height: 130px;
        margin: 16px 0 8px;
        padding: 16px 0;
    }
    .track-rail {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 2px;
        background: repeating-linear-gradient(
            to right,
            rgba(0, 0, 0, 0.15) 0,
            rgba(0, 0, 0, 0.15) 6px,
            transparent 6px,
            transparent 12px
        );
        transform: translateY(-1px);
    }
    :global(.dark) .track-rail {
        background: repeating-linear-gradient(
            to right,
            rgba(255, 255, 255, 0.18) 0,
            rgba(255, 255, 255, 0.18) 6px,
            transparent 6px,
            transparent 12px
        );
    }

    .stop {
        position: absolute;
        top: 0;
        font-size: 11px;
        font-family: ui-monospace, monospace;
        color: #9ca3af;
        transform: translateX(-50%);
    }
    .stop.active {
        color: #2563eb;
        font-weight: 700;
    }
    :global(.dark) .stop.active {
        color: #93c5fd;
    }
    .stop::after {
        content: '';
        display: block;
        width: 2px;
        height: 8px;
        margin: 2px auto 0;
        background: currentColor;
    }

    .rotate-track {
        height: 140px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* `:global()` required: motion.div doesn't receive Svelte's scoping hash
       on its class prop, so locally-scoped selectors are stripped. */
    .track :global(.box) {
        position: absolute;
        top: 50%;
        left: 0;
        transform-origin: center;
        margin-top: -42px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 84px;
        height: 84px;
        border-radius: 14px;
        font-weight: 700;
        color: white;
        font-size: 13px;
        will-change: transform;
        box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
    .rotate-track :global(.box) {
        position: static;
        margin-top: 0;
    }
    .track :global(.blue) {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
    }
    .track :global(.pink) {
        background: linear-gradient(135deg, #ec4899, #db2777);
    }
    .track :global(.green) {
        background: linear-gradient(135deg, #10b981, #059669);
    }

    footer {
        margin-top: 40px;
        padding: 20px 24px;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 12px;
        color: #78350f;
    }
    :global(.dark) footer {
        background: rgba(252, 211, 77, 0.08);
        border-color: rgba(252, 211, 77, 0.3);
        color: #fcd34d;
    }
    footer h3 {
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    footer ul {
        margin: 0;
        padding-left: 22px;
        font-size: 14px;
        line-height: 1.7;
    }
    footer code {
        background: rgba(255, 255, 255, 0.5);
        color: inherit;
    }
    :global(.dark) footer code {
        background: rgba(255, 255, 255, 0.05);
    }
</style>
