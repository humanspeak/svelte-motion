<script lang="ts">
    import { CircleDot, RotateCcw } from '@lucide/svelte'
    import { motion, styleString, useSpring, useTransform } from '@humanspeak/svelte-motion'

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

    // Library-driven button chrome: base style inline, interaction via motion props.
    const buttonLayout = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '0.5rem 0.875rem',
        cursor: 'pointer'
    } as const
    const buttonStyle = styleString(() => ({
        ...buttonLayout,
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        backgroundColor: 'var(--brut-bg, #f8fcfb)',
        color: 'var(--brut-ink, #0a0a0a)'
    }))
    const buttonPrimaryStyle = styleString(() => ({
        ...buttonLayout,
        border: '1px solid var(--brut-accent, #247768)',
        backgroundColor: 'var(--brut-accent, #247768)',
        color: 'var(--brut-accent-ink, #f8fcfb)'
    }))
    const buttonHover = { scale: 1.04 }
    const buttonTap = { scale: 0.96 }
    const buttonTransition = { type: 'spring', stiffness: 500, damping: 30 } as const
</script>

<!--
  Uses <span> rather than <strong>/<code>: docs pages wrap embedded demos in
  `.prose-v2`, whose `strong`/`code` rules match this markup at equal specificity
  and win on cascade order, repainting the text in the page's ink colour.
-->
<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" role="toolbar" aria-label="Progress controls">
        <motion.button
            type="button"
            onclick={() => setProgress(0.25)}
            whileHover={buttonHover}
            whileTap={buttonTap}
            transition={buttonTransition}
            style={buttonStyle}
        >
            25%
        </motion.button>
        <motion.button
            type="button"
            onclick={() => setProgress(0.5)}
            whileHover={buttonHover}
            whileTap={buttonTap}
            transition={buttonTransition}
            style={buttonStyle}
        >
            50%
        </motion.button>
        <motion.button
            type="button"
            onclick={() => setProgress(1)}
            whileHover={buttonHover}
            whileTap={buttonTap}
            transition={buttonTransition}
            style={buttonPrimaryStyle}
        >
            <CircleDot size={15} />
            Complete
        </motion.button>
        <motion.button
            type="button"
            onclick={() => setProgress(0)}
            whileHover={buttonHover}
            whileTap={buttonTap}
            transition={buttonTransition}
            style={buttonStyle}
        >
            <RotateCcw size={15} />
            Reset
        </motion.button>
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
        width: 100%;
        min-height: clamp(420px, calc(100vh - 240px), 560px);
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
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
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background:
            linear-gradient(90deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            linear-gradient(0deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            var(--brut-bg-2, #eef4f1);
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
        color: var(--brut-accent, #247768);
        font-family: var(--brut-mono, monospace);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    .title {
        color: var(--brut-ink, #0a0a0a);
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
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .panel-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 4px 12px;
    }

    .panel-title {
        color: var(--brut-ink, #0a0a0a);
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
        stroke: var(--brut-rule-2, #bbc4c0);
        stroke-width: 12;
    }

    .ring-label {
        fill: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 24px;
        font-weight: 800;
        text-anchor: middle;
    }

    /* motion.* render their own elements, so Svelte's scoping never reaches them. */
    .dk-demo-shell :global(.ring-value) {
        fill: none;
        stroke: var(--brut-accent, #247768);
        stroke-width: 12;
        stroke-linecap: round;
    }

    .dk-demo-shell :global(.track-fill) {
        stroke: var(--brut-accent, #247768);
        stroke-width: 4;
        stroke-linecap: round;
    }

    .dk-demo-shell :global(.track-dot) {
        fill: var(--brut-ink, #0a0a0a);
    }

    .track {
        width: 100%;
        margin: auto 0;
    }

    .track-rail {
        stroke: var(--brut-rule-2, #bbc4c0);
        stroke-width: 4;
        stroke-linecap: round;
    }

    .hint {
        margin: 0;
        color: var(--brut-ink-2, #525252);
        font-size: 12px;
        line-height: 1.6;
    }

    .mono {
        padding: 1px 4px;
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
        font-family: var(--brut-mono, monospace);
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
