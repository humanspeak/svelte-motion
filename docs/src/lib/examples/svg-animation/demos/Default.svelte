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
            <span>one MotionValue</span>
            <strong>Bound straight to SVG attributes — no keyframes</strong>
        </div>

        <div class="panels">
            <section class="panel">
                <div class="panel-head">
                    <span>stroke-dashoffset</span>
                    <strong>progress ring</strong>
                </div>
                <svg viewBox="0 0 140 140" class="ring" role="img" aria-label="{percent}% complete">
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
                    <span>cx &amp; x2</span>
                    <strong>both DOM channels</strong>
                </div>
                <svg viewBox="0 0 300 90" class="track" role="presentation">
                    <line x1="16" y1="62" x2="284" y2="62" class="track-rail" />
                    <motion.line x1={16} y1={62} x2={lineX2} y2={62} class="track-fill" />
                    <motion.circle cx={dotCx} cy={62} r={9} class="track-dot" />
                </svg>
                <p class="hint">
                    <code>cx</code> is a CSS property, so Motion writes it to
                    <code>element.style</code>. <code>x2</code> is not, so it is written with
                    <code>setAttribute</code>. Same MotionValue, different channels.
                </p>
            </section>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        min-height: clamp(420px, calc(100vh - 240px), 560px);
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        background: #0d1518;
        color: #eef6fb;
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
        border: 1px solid #46616a;
        border-radius: 6px;
        background: #142127;
        color: #eef6fb;
        font-size: 13px;
        font-weight: 780;
        cursor: pointer;
    }

    button.primary {
        border-color: #5eead4;
        background: #0f766e;
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
        border: 1px solid #2b4650;
        background:
            linear-gradient(90deg, rgba(94, 234, 212, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(94, 234, 212, 0.1) 1px, transparent 1px), #071114;
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

    .intro span,
    .panel-head span {
        color: #67e8f9;
        font-size: 11px;
        font-weight: 850;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    .intro strong {
        color: #ecfeff;
        font-size: 18px;
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
        border: 1px solid rgba(134, 184, 199, 0.42);
        background: rgba(13, 27, 33, 0.74);
    }

    .panel-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 4px 12px;
    }

    .panel-head strong {
        color: #ecfeff;
        font-size: 16px;
        line-height: 1.05;
    }

    .ring {
        width: 100%;
        max-width: 190px;
        margin: auto;
    }

    .ring-track {
        fill: none;
        stroke: rgba(186, 230, 253, 0.16);
        stroke-width: 12;
    }

    .ring-label {
        fill: #ecfeff;
        font-size: 24px;
        font-weight: 800;
        text-anchor: middle;
    }

    /* motion.* render their own elements, so Svelte's scoping never reaches them. */
    :global(.ring-value) {
        fill: none;
        stroke: #5eead4;
        stroke-width: 12;
        stroke-linecap: round;
        filter: drop-shadow(0 0 12px rgba(94, 234, 212, 0.45));
    }

    :global(.track-fill) {
        stroke: #38bdf8;
        stroke-width: 4;
        stroke-linecap: round;
    }

    :global(.track-dot) {
        fill: #fb7185;
        filter: drop-shadow(0 0 10px rgba(251, 113, 133, 0.5));
    }

    .track {
        width: 100%;
        margin: auto 0;
    }

    .track-rail {
        stroke: rgba(186, 230, 253, 0.24);
        stroke-width: 4;
        stroke-linecap: round;
    }

    .hint {
        margin: 0;
        color: #9fb9c4;
        font-size: 12px;
        line-height: 1.5;
    }

    .hint code {
        color: #5eead4;
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
