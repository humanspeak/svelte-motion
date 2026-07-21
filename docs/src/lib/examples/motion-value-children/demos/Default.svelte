<script lang="ts">
    import {
        animate,
        motion,
        styleString,
        useMotionValue,
        useTransform
    } from '@humanspeak/svelte-motion'

    const progress = useMotionValue(0)
    const packets = useTransform(progress, [0, 1], [1840, 24680])
    const packetsText = useTransform(packets, (latest) =>
        Math.round(latest).toLocaleString('en-US')
    )
    const signalText = useTransform(progress, (latest) => `${Math.round(12 + latest * 88)}%`)
    const latency = useTransform(progress, [0, 1], [42, 8])
    const latencyText = useTransform(latency, (latest) => `${Math.round(latest)}ms`)
    const phaseText = useTransform(progress, (latest) =>
        latest > 0.78 ? 'LOCKED' : latest > 0.42 ? 'TUNING' : 'IDLE'
    )

    let run = $state(0)

    const buttonStyle = styleString(() => ({
        height: '38px',
        padding: '0 14px',
        border: '1px solid var(--brut-accent, #247768)',
        background: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
        color: 'var(--brut-accent, #247768)',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '12px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        cursor: 'pointer'
    }))

    async function sweep() {
        run += 1
        progress.jump(0)
        await animate(progress, 1, {
            duration: 0.9,
            ease: 'easeOut'
        })
    }

    function reset() {
        progress.jump(0)
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <section class="console" aria-label="Live telemetry">
        <div class="console-top">
            <div>
                <span>// uplink phase</span>
                <strong><motion.span children={phaseText} /></strong>
            </div>
            <em>run {String(run).padStart(2, '0')}</em>
        </div>

        <div class="signal">
            <div style="transform: scaleX({progress.current})"></div>
        </div>

        <div class="tiles">
            <article>
                <span>packets</span>
                <b><motion.span children={packetsText} /></b>
            </article>
            <article>
                <span>signal</span>
                <b><motion.span children={signalText} /></b>
            </article>
            <article>
                <span>latency</span>
                <b><motion.span children={latencyText} /></b>
            </article>
        </div>

        <div class="actions">
            <motion.button
                type="button"
                onclick={sweep}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={buttonStyle}
            >
                Sweep uplink
            </motion.button>
            <motion.button
                type="button"
                onclick={reset}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={buttonStyle}
            >
                Reset
            </motion.button>
        </div>
    </section>
</div>

<style>
    .dk-demo-shell {
        min-height: 540px;
        display: grid;
        place-items: center;
        padding: 2rem;
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
    }

    .console {
        width: min(100%, 720px);
        display: grid;
        gap: 18px;
        padding: 24px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .console-top,
    .actions {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
    }

    span,
    em {
        color: var(--brut-ink-3, #9a9a9a);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
        font-style: normal;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    strong {
        display: block;
        margin-top: 6px;
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 34px;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }

    .signal {
        height: 12px;
        overflow: hidden;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    .signal div {
        width: 100%;
        height: 100%;
        transform-origin: 0 50%;
        background: var(--brut-accent, #247768);
    }

    .tiles {
        display: grid;
        grid-template-columns: minmax(240px, 1.5fr) minmax(150px, 0.85fr) minmax(150px, 0.85fr);
        gap: 12px;
    }

    article {
        min-width: 0;
        padding: 16px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    b {
        display: block;
        margin-top: 8px;
        min-height: 46px;
        color: var(--brut-accent, #247768);
        font-family: var(--brut-mono, monospace);
        font-size: clamp(26px, 6vw, 46px);
        font-weight: 700;
        line-height: 0.95;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
    }

    @media (max-width: 620px) {
        .tiles {
            grid-template-columns: 1fr;
        }
    }
</style>
