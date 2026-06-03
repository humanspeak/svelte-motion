<script lang="ts">
    import { ArrowLeft, ArrowRight, RotateCcw, Send } from '@lucide/svelte'
    import {
        animate,
        motion,
        useMotionTemplate,
        useMotionValue,
        useTransform,
        type RawMotionValue
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

    async function route() {
        const id = ++runId
        phase = 'routing'
        progress.jump(0)
        await animate(progress as unknown as RawMotionValue<number>, 1, {
            duration: 0.95,
            ease: [0.22, 1, 0.36, 1]
        })
        if (id === runId) phase = 'delivered'
    }

    async function reverse() {
        const id = ++runId
        phase = 'routing'
        await animate(progress as unknown as RawMotionValue<number>, 0, {
            duration: 0.95,
            ease: [0.22, 1, 0.36, 1]
        })
        if (id === runId) phase = 'queued'
    }

    function reset() {
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
        padding: 0 12px;
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
        width: 100%;
        min-height: 460px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid #2b4650;
        background:
            linear-gradient(90deg, rgba(94, 234, 212, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(94, 234, 212, 0.1) 1px, transparent 1px), #071114;
        background-size: 44px 44px;
    }

    .stage::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
            radial-gradient(circle at 14% 62%, rgba(45, 212, 191, 0.12), transparent 24%),
            radial-gradient(circle at 86% 34%, rgba(251, 113, 133, 0.12), transparent 28%);
        pointer-events: none;
    }

    .route-line {
        position: absolute;
        left: 10%;
        right: 10%;
        top: 50%;
        height: 1px;
        background: linear-gradient(90deg, #5eead4, #38bdf8, #fb7185);
        opacity: 0.55;
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
        border: 1px solid #365766;
        background: rgba(16, 31, 38, 0.78);
        color: #dff7ff;
        font-weight: 850;
    }

    .endpoint span {
        font-size: 14px;
    }

    .endpoint small {
        color: #86b8c7;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .left-end {
        left: 6%;
        border-radius: 16px 4px 4px 16px;
    }

    .right-end {
        right: 6%;
        border-radius: 4px 16px 16px 4px;
        text-align: right;
    }

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
        border: 1px solid rgba(236, 254, 255, 0.48);
        border-radius: 18px;
        background:
            radial-gradient(
                circle at calc(50% + var(--packet-x, 0px)) 50%,
                rgba(255, 255, 255, 0.22),
                transparent 52%
            ),
            #0f766e;
        color: #f8fafc;
        text-align: center;
        transform-origin: 50% 50%;
        will-change: transform;
    }

    :global(.packet) span {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0;
    }

    :global(.packet) small {
        color: rgba(255, 255, 255, 0.76);
        font-size: 11px;
        font-weight: 820;
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
