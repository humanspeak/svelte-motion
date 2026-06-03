<script lang="ts">
    import { animate, motion, useMotionValue, useTransform, type RawMotionValue } from '$lib'

    const progress = useMotionValue(0)
    const score = useTransform(progress, [0, 1], [1200, 9800])
    const scoreText = useTransform(score, (latest) => Math.round(latest).toLocaleString('en-US'))
    const chargeText = useTransform(progress, (latest) => `${Math.round(18 + latest * 82)}%`)
    const temperature = useTransform(progress, [0, 1], [41, 88])
    const temperatureText = useTransform(temperature, (latest) => `${Math.round(latest)}deg`)
    const statusText = useTransform(progress, (latest) =>
        latest > 0.78 ? 'SYNCED' : latest > 0.42 ? 'ALIGNING' : 'WARMING'
    )

    let run = $state(0)

    async function play(target = 1) {
        run += 1
        progress.jump(0)
        await animate(progress as unknown as RawMotionValue<number>, target, {
            duration: 0.7,
            ease: 'easeOut'
        })
    }

    function reset() {
        run += 1
        progress.jump(0)
    }
</script>

<svelte:head>
    <title>MotionValue children</title>
</svelte:head>

<main>
    <section class="intro">
        <p class="kicker">MotionValue children (#318)</p>
        <h1>Motion values can render live text.</h1>
        <p>
            These readouts use <code>motion.span children=&#123;motionValue&#125;</code>. The
            numbers update through the motion value child path, not template interpolation.
        </p>
    </section>

    <section class="panel" data-testid="motion-value-children-panel">
        <div class="panel-top">
            <div>
                <span class="label">sequence</span>
                <strong data-testid="motion-value-status">
                    <motion.span children={statusText} />
                </strong>
            </div>
            <div class="run" data-testid="motion-value-run">run {run}</div>
        </div>

        <div class="meter">
            <motion.div
                class="meter-fill"
                style="transform-origin: 0 50%"
                initial={false}
                animate={{ scaleX: progress.current }}
                data-testid="motion-value-meter"
            />
        </div>

        <dl class="readouts">
            <div>
                <dt>score</dt>
                <dd data-testid="motion-value-score">
                    <motion.span children={scoreText} />
                </dd>
            </div>
            <div>
                <dt>charge</dt>
                <dd data-testid="motion-value-charge">
                    <motion.span children={chargeText} />
                </dd>
            </div>
            <div>
                <dt>temp</dt>
                <dd data-testid="motion-value-temperature">
                    <motion.span children={temperatureText} />
                </dd>
            </div>
        </dl>

        <div class="actions">
            <button type="button" data-testid="motion-value-play" onclick={() => play()}>
                Run sweep
            </button>
            <button type="button" data-testid="motion-value-reset" onclick={reset}>Reset</button>
        </div>
    </section>
</main>

<style>
    :global(html),
    :global(body) {
        min-height: 100%;
        height: auto;
        margin: 0;
        overflow-y: auto;
        background: #071012;
        color: #ecfdf5;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    :global(body > .h-full),
    :global(body > .h-full > .h-full),
    :global(.container),
    :global(#sandbox) {
        min-height: 100vh;
        height: auto;
    }

    main {
        min-height: 100vh;
        width: min(900px, calc(100vw - 32px));
        display: grid;
        align-content: center;
        gap: 28px;
        margin: 0 auto;
        padding: 48px 0;
    }

    .intro {
        max-width: 700px;
    }

    .kicker {
        margin: 0 0 8px;
        color: #5eead4;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: 36px;
        line-height: 1.05;
    }

    .intro p:not(.kicker) {
        margin: 12px 0 0;
        color: #aec6c3;
        font-size: 16px;
        line-height: 1.65;
    }

    code {
        color: #a7f3d0;
    }

    .panel {
        display: grid;
        gap: 22px;
        padding: 28px;
        border: 1px solid #22524c;
        background:
            linear-gradient(90deg, rgba(94, 234, 212, 0.11) 1px, transparent 1px),
            linear-gradient(0deg, rgba(94, 234, 212, 0.11) 1px, transparent 1px), #0c191b;
        background-size: 38px 38px;
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.36);
    }

    .panel-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
    }

    .label,
    dt,
    .run {
        color: #8bb8b3;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    strong {
        display: block;
        margin-top: 6px;
        color: #f8fafc;
        font-size: 32px;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }

    .meter {
        height: 12px;
        overflow: hidden;
        border: 1px solid #27655c;
        background: #081112;
    }

    :global(.meter-fill) {
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, #2dd4bf, #bef264, #f9a8d4);
    }

    .readouts {
        display: grid;
        grid-template-columns: minmax(240px, 1.5fr) minmax(150px, 0.85fr) minmax(150px, 0.85fr);
        gap: 12px;
        margin: 0;
    }

    .readouts > div {
        min-width: 0;
        padding: 16px;
        border: 1px solid #1d4d47;
        background: rgba(8, 17, 18, 0.8);
    }

    dd {
        margin: 8px 0 0;
        min-height: 46px;
        color: #c6ffdc;
        font-size: clamp(28px, 6vw, 46px);
        font-weight: 850;
        line-height: 0.95;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
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

    @media (max-width: 640px) {
        .readouts {
            grid-template-columns: 1fr;
        }
    }
</style>
