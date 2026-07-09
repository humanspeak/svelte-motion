<script lang="ts">
    import { animate, motion, useMotionValue, useTransform } from '@humanspeak/svelte-motion'

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
                <span>uplink phase</span>
                <strong><motion.span children={phaseText} /></strong>
            </div>
            <em>run {run}</em>
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
            <button type="button" onclick={sweep}>Sweep uplink</button>
            <button type="button" onclick={reset}>Reset</button>
        </div>
    </section>
</div>

<style>
    .dk-demo-shell {
        min-height: 540px;
        display: grid;
        place-items: center;
        padding: 2rem;
        background:
            radial-gradient(circle at 76% 18%, rgba(190, 242, 100, 0.16), transparent 34%),
            radial-gradient(circle at 18% 82%, rgba(45, 212, 191, 0.15), transparent 32%), #071012;
        color: #ecfdf5;
    }

    .console {
        width: min(100%, 720px);
        display: grid;
        gap: 18px;
        padding: 24px;
        border: 1px solid #245c54;
        background:
            linear-gradient(90deg, rgba(94, 234, 212, 0.11) 1px, transparent 1px),
            linear-gradient(0deg, rgba(94, 234, 212, 0.11) 1px, transparent 1px), #0c191b;
        background-size: 38px 38px;
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.36);
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
        color: #8bb8b3;
        font-size: 12px;
        font-style: normal;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    strong {
        display: block;
        margin-top: 6px;
        color: #f8fafc;
        font-size: 34px;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }

    .signal {
        height: 12px;
        overflow: hidden;
        border: 1px solid #27655c;
        background: #081112;
    }

    .signal div {
        width: 100%;
        height: 100%;
        transform-origin: 0 50%;
        background: linear-gradient(90deg, #2dd4bf, #bef264, #f9a8d4);
    }

    .tiles {
        display: grid;
        grid-template-columns: minmax(240px, 1.5fr) minmax(150px, 0.85fr) minmax(150px, 0.85fr);
        gap: 12px;
    }

    article {
        min-width: 0;
        padding: 16px;
        border: 1px solid #1d4d47;
        background: rgba(8, 17, 18, 0.8);
    }

    b {
        display: block;
        margin-top: 8px;
        min-height: 46px;
        color: #c6ffdc;
        font-size: clamp(26px, 6vw, 46px);
        font-weight: 850;
        line-height: 0.95;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
    }

    button {
        height: 38px;
        padding: 0 14px;
        border: 1px solid #2f7b70;
        border-radius: 6px;
        background: #102123;
        color: #ecfdf5;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
    }

    button:hover {
        border-color: #5eead4;
    }

    @media (max-width: 620px) {
        .tiles {
            grid-template-columns: 1fr;
        }
    }
</style>
