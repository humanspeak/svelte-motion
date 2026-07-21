<script lang="ts">
    import { ArrowLeft, ArrowRight, RotateCcw, Send } from '@lucide/svelte'
    import {
        animate,
        motion,
        useMotionTemplate,
        useMotionValue,
        useTransform
    } from '@humanspeak/svelte-motion'

    const progress = useMotionValue(0)
    const x = useTransform(progress, [0, 1], ['-30vw', '30vw'])
    const y = useTransform(progress, [0, 0.5, 1], [76, -64, 52])
    const rotate = useTransform(progress, [0, 1], [-7, 8])
    const scale = useTransform(progress, [0, 0.5, 1], [0.92, 1.18, 1])
    const opacity = useTransform(progress, [0, 0.15, 1], [0.62, 1, 1])
    const hue = useTransform(progress, (latest) => 192 + latest * 126)
    const backgroundColor = useTransform(hue, (latest) => `hsl(${latest}, 82%, 46%)`)
    const glowX = x
    const shadowAlpha = useTransform(progress, [0, 1], [0.2, 0.52])
    const boxShadow = useMotionTemplate`0 28px 90px rgba(45, 212, 191, ${shadowAlpha})`

    let phase = $state<'queued' | 'routing' | 'delivered'>('queued')
    let runId = 0
    let activeAnimation: { stop: () => void } | null = null

    function stopActiveAnimation() {
        activeAnimation?.stop()
        activeAnimation = null
    }

    async function route() {
        stopActiveAnimation()
        const id = ++runId
        phase = 'routing'
        progress.jump(0)
        const animation = animate(progress, 1, {
            duration: 0.95,
            ease: [0.22, 1, 0.36, 1]
        })
        activeAnimation = animation
        await animation
        if (activeAnimation === animation) activeAnimation = null
        if (id === runId) phase = 'delivered'
    }

    async function reverse() {
        stopActiveAnimation()
        const id = ++runId
        phase = 'routing'
        const animation = animate(progress, 0, {
            duration: 0.95,
            ease: [0.22, 1, 0.36, 1]
        })
        activeAnimation = animation
        await animation
        if (activeAnimation === animation) activeAnimation = null
        if (id === runId) phase = 'queued'
    }

    function reset() {
        stopActiveAnimation()
        runId += 1
        phase = 'queued'
        progress.jump(0)
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="Packet route controls">
        <button type="button" onclick={reverse}>
            <ArrowLeft size={15} />
            Return
        </button>
        <button type="button" class="primary" onclick={route}>
            <Send size={15} />
            Deliver
            <ArrowRight size={15} />
        </button>
        <button type="button" onclick={reset}>
            <RotateCcw size={15} />
            Reset
        </button>
    </div>

    <div class="stage">
        <div class="endpoint left-end">
            <span>Origin</span>
            <small>queued</small>
        </div>
        <div class="endpoint right-end">
            <span>Destination</span>
            <small>delivered</small>
        </div>
        <div class="route-line" aria-hidden="true"></div>

        <motion.div
            class="packet"
            data-phase={phase}
            style={{
                x,
                y,
                rotate,
                scale,
                opacity,
                backgroundColor,
                boxShadow,
                '--packet-x': glowX
            }}
        >
            <span>{phase}</span>
            <small>style object</small>
        </motion.div>
    </div>
</div>

<style>
    .dk-demo-shell {
        position: relative;
        width: 100%;
        min-height: 520px;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr;
        align-items: stretch;
        gap: 20px;
        padding: 2rem;
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
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
        padding: 0 12px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        cursor: pointer;
    }

    button.primary {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .stage {
        position: relative;
        width: 100%;
        min-height: 460px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background:
            linear-gradient(90deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            linear-gradient(0deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            var(--brut-bg-2, #eef4f1);
        background-size: 44px 44px;
    }

    .route-line {
        position: absolute;
        left: 10%;
        right: 10%;
        top: 50%;
        height: 0;
        border-top: 1px dashed var(--brut-accent, #247768);
    }

    .endpoint {
        position: absolute;
        top: calc(50% - 72px);
        width: 148px;
        min-height: 72px;
        display: grid;
        align-content: center;
        gap: 5px;
        padding: 0 16px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
    }

    .endpoint span {
        font-family: var(--brut-mono, monospace);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .endpoint small {
        color: var(--brut-ink-3, #9a9a9a);
        font-family: var(--brut-mono, monospace);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .left-end {
        left: 6%;
    }

    .right-end {
        right: 6%;
        text-align: right;
    }

    /* Position + size + text chrome only. The colour (hsl backgroundColor),
       boxShadow, transform, and --packet-x glow are all driven by the MV
       style object on the element and must stay there. */
    :global(.packet) {
        position: absolute;
        top: calc(50% - 60px);
        left: calc(50% - 78px);
        width: 156px;
        height: 120px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 6px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background-image: radial-gradient(
            circle at calc(50% + var(--packet-x, 0px)) 50%,
            rgba(255, 255, 255, 0.28),
            transparent 52%
        );
        color: var(--brut-accent-ink, #f8fcfb);
        text-align: center;
        transform-origin: 50% 50%;
        will-change: transform;
    }

    :global(.packet) span {
        font-family: var(--brut-mono, monospace);
        font-size: 20px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    :global(.packet) small {
        color: rgba(248, 252, 251, 0.82);
        font-family: var(--brut-mono, monospace);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    @media (max-width: 560px) {
        .dk-demo-shell {
            padding: 1rem;
        }

        .stage {
            min-height: 390px;
        }

        .endpoint {
            width: 118px;
            min-height: 62px;
            padding: 0 12px;
        }

        .left-end {
            left: 16px;
        }

        .right-end {
            right: 16px;
        }

        :global(.packet) {
            width: 140px;
            height: 100px;
            left: calc(50% - 70px);
        }
    }
</style>
