<script lang="ts">
    import { CircleDot, RotateCcw } from '@lucide/svelte'
    import { motion, useSpring, useTransform } from '@humanspeak/svelte-motion'

    const RADIUS = 54
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS

    /** A single spring drives every bound attribute below. */
    const progress = useSpring(0, { stiffness: 120, damping: 20 })

    /** Style-routed: `stroke-dashoffset` is a CSS property, so it lands on element.style. */
    const dashOffset = useTransform(progress, [0, 1], [CIRCUMFERENCE, 0])

    /** Style-routed: the dot's `cx` sweeps across the track. */
    const dotCx = useTransform(progress, [0, 1], [16, 284])

    /** Attribute-routed: `x2` is not a CSS property, so it lands on setAttribute. */
    const lineX2 = useTransform(progress, [0, 1], [16, 284])

    let percent = $state(0)
    const setProgress = (value: number) => {
        percent = Math.round(value * 100)
        progress.set(value)
    }
</script>

<!--
  Uses <span> rather than <strong>/<code>: docs pages wrap embedded demos in
  `.prose-v2`, whose `strong`/`code` rules match this markup at equal specificity
  and win on cascade order, repainting the text in the page's ink colour.
-->
<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="Progress controls">
        <button type="button" onclick={() => setProgress(0.25)}>25%</button>
        <button type="button" onclick={() => setProgress(0.5)}>50%</button>
        <button type="button" class="primary" onclick={() => setProgress(1)}>
            <CircleDot size={15} />
            Complete
        </button>
        <button type="button" onclick={() => setProgress(0)}>
            <RotateCcw size={15} />
            Reset
        </button>
    </div>

    <div class="stage">
        <div class="intro">
            <span class="eyebrow">one MotionValue</span>
            <span class="title">Bound straight to SVG attributes — no keyframes</span>
        </div>

        <div class="panels">
            <section class="panel">
                <div class="panel-head">
                    <span class="eyebrow">stroke-dashoffset</span>
                    <span class="panel-title">progress ring</span>
                </div>
                <svg
                    viewBox="0 0 140 140"
                    class="progress-ring"
                    role="img"
                    aria-label="{percent}% complete"
                >
                    <circle cx="70" cy="70" r={RADIUS} class="ring-track" />
                    <motion.circle
                        cx={70}
                        cy={70}
                        r={RADIUS}
                        class="ring-value"
                        stroke-dasharray={CIRCUMFERENCE}
                        stroke-dashoffset={dashOffset}
                        transform="rotate(-90 70 70)"
                    />
                    <text x="70" y="78" class="ring-label">{percent}%</text>
                </svg>
            </section>

            <section class="panel">
                <div class="panel-head">
                    <span class="eyebrow">cx &amp; x2</span>
                    <span class="panel-title">both DOM channels</span>
                </div>
                <svg viewBox="0 0 300 90" class="track" role="presentation">
                    <line x1="16" y1="62" x2="284" y2="62" class="track-rail" />
                    <motion.line x1={16} y1={62} x2={lineX2} y2={62} class="track-fill" />
                    <motion.circle cx={dotCx} cy={62} r={9} class="track-dot" />
                </svg>
                <p class="hint">
                    <span class="mono">cx</span> is a CSS property, so Motion writes it to
                    <span class="mono">element.style</span>. <span class="mono">x2</span> is not, so
                    it is written with <span class="mono">setAttribute</span>. Same MotionValue,
                    different channels.
                </p>
            </section>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        /* Light theme by default; overridden under `html.dark` below. */
        --demo-bg: #f1f5f9;
        --demo-stage-bg: #ffffff;
        --demo-grid: rgba(15, 118, 110, 0.08);
        --demo-panel-bg: rgba(248, 250, 252, 0.9);
        --demo-border: #cbd5e1;
        --demo-panel-border: #d5dee7;
        --demo-ink: #0f172a;
        --demo-ink-soft: #475569;
        --demo-accent: #0f766e;
        --demo-ring: #0d9488;
        --demo-line: #0284c7;
        --demo-dot: #e11d48;
        --demo-rail: rgba(15, 23, 42, 0.14);
        --demo-track: rgba(15, 23, 42, 0.1);
        --demo-btn-bg: #ffffff;
        --demo-btn-border: #cbd5e1;
        --demo-glow: transparent;

        width: 100%;
        min-height: clamp(420px, calc(100vh - 240px), 560px);
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        background: var(--demo-bg);
        color: var(--demo-ink);
    }

    :global(html.dark) .dk-demo-shell {
        --demo-bg: #0d1518;
        --demo-stage-bg: #071114;
        --demo-grid: rgba(94, 234, 212, 0.1);
        --demo-panel-bg: rgba(13, 27, 33, 0.74);
        --demo-border: #2b4650;
        --demo-panel-border: rgba(134, 184, 199, 0.42);
        --demo-ink: #ecfeff;
        --demo-ink-soft: #9fb9c4;
        --demo-accent: #67e8f9;
        --demo-ring: #5eead4;
        --demo-line: #38bdf8;
        --demo-dot: #fb7185;
        --demo-rail: rgba(186, 230, 253, 0.24);
        --demo-track: rgba(186, 230, 253, 0.16);
        --demo-btn-bg: #142127;
        --demo-btn-border: #46616a;
        --demo-glow: rgba(94, 234, 212, 0.45);
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }

    button {
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 14px;
        border: 1px solid var(--demo-btn-border);
        border-radius: 6px;
        background: var(--demo-btn-bg);
        color: var(--demo-ink);
        font-size: 13px;
        font-weight: 780;
        cursor: pointer;
    }

    button.primary {
        border-color: var(--demo-ring);
        background: var(--demo-accent);
        color: #f0fdfa;
    }

    :global(html.dark) button.primary {
        background: #0f766e;
        color: #ecfeff;
    }

    .stage {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 20px;
        overflow: hidden;
        border: 1px solid var(--demo-border);
        background:
            linear-gradient(90deg, var(--demo-grid) 1px, transparent 1px),
            linear-gradient(0deg, var(--demo-grid) 1px, transparent 1px), var(--demo-stage-bg);
        background-size: 44px 44px;
    }

    .intro {
        position: relative;
        z-index: 3;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px 12px;
    }

    .eyebrow {
        color: var(--demo-accent);
        font-size: 11px;
        font-weight: 850;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    .title {
        color: var(--demo-ink);
        font-size: 18px;
        font-weight: 750;
        line-height: 1.1;
    }

    .panels {
        position: relative;
        z-index: 2;
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        align-content: start;
        gap: 14px;
    }

    .panel {
        position: relative;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--demo-panel-border);
        background: var(--demo-panel-bg);
    }

    .panel-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 4px 12px;
    }

    .panel-title {
        color: var(--demo-ink);
        font-size: 16px;
        font-weight: 750;
        line-height: 1.05;
    }

    .progress-ring {
        width: 100%;
        max-width: 190px;
        margin: auto;
    }

    .ring-track {
        fill: none;
        stroke: var(--demo-track);
        stroke-width: 12;
    }

    .ring-label {
        fill: var(--demo-ink);
        font-size: 24px;
        font-weight: 800;
        text-anchor: middle;
    }

    /* motion.* render their own elements, so Svelte's scoping never reaches them. */
    .dk-demo-shell :global(.ring-value) {
        fill: none;
        stroke: var(--demo-ring);
        stroke-width: 12;
        stroke-linecap: round;
        filter: drop-shadow(0 0 12px var(--demo-glow));
    }

    .dk-demo-shell :global(.track-fill) {
        stroke: var(--demo-line);
        stroke-width: 4;
        stroke-linecap: round;
    }

    .dk-demo-shell :global(.track-dot) {
        fill: var(--demo-dot);
    }

    .track {
        width: 100%;
        margin: auto 0;
    }

    .track-rail {
        stroke: var(--demo-rail);
        stroke-width: 4;
        stroke-linecap: round;
    }

    .hint {
        margin: 0;
        color: var(--demo-ink-soft);
        font-size: 12px;
        line-height: 1.6;
    }

    .mono {
        padding: 1px 4px;
        border-radius: 3px;
        background: var(--demo-track);
        color: var(--demo-ring);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
    }

    @media (max-width: 900px) {
        .dk-demo-shell {
            padding: 1rem;
        }

        .intro {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
        }

        .panels {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
