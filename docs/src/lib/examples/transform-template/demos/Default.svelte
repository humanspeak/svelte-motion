<script lang="ts">
    import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from '@lucide/svelte'
    import { animate, motion, useMotionValue, useTransform } from '@humanspeak/svelte-motion'

    const travel = 700
    const progress = useMotionValue(0)
    const x = useTransform(progress, [0, 1], [0, travel])

    let state = $state<'start' | 'moving' | 'end'>('start')
    let activeAnimation: { stop: () => void } | null = null
    let runId = 0

    const transformTemplate = ({ x }: Record<string, string | number>, generated: string) => {
        const distance = Number.parseFloat(String(x ?? 0)) || 0
        const amount = Math.max(0, Math.min(distance / travel, 1))
        const lift = Math.sin(amount * Math.PI) * -70
        const rotate = amount * 7 - 3.5

        return `translateY(${lift.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg) ${generated}`.trim()
    }

    function stopActiveAnimation() {
        activeAnimation?.stop()
        activeAnimation = null
    }

    async function moveTo(target: 0 | 1) {
        stopActiveAnimation()
        const id = ++runId
        state = 'moving'

        const animation = animate(progress, target, {
            duration: 1,
            ease: [0.22, 1, 0.36, 1]
        })

        activeAnimation = animation
        await animation
        if (activeAnimation === animation) activeAnimation = null
        if (id === runId) state = target === 1 ? 'end' : 'start'
    }

    function reset() {
        stopActiveAnimation()
        runId += 1
        progress.jump(0)
        state = 'start'
    }
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="Transform template controls">
        <button type="button" onclick={() => moveTo(0)}>
            <ArrowLeft size={15} />
            Back
        </button>
        <button type="button" class="primary" onclick={() => moveTo(1)}>
            <Sparkles size={15} />
            Apply template
            <ArrowRight size={15} />
        </button>
        <button type="button" onclick={reset}>
            <RotateCcw size={15} />
            Reset
        </button>
    </div>

    <div class="stage">
        <div class="intro">
            <span>same MotionValue</span>
            <strong>Generated x, custom final transform</strong>
        </div>

        <div class="comparison" aria-label="Generated transform compared with transformTemplate">
            <section class="lane generated-lane">
                <div class="lane-head">
                    <span>generated</span>
                    <strong>straight transform</strong>
                </div>
                <div class="track">
                    <div class="slot start-slot" aria-label="Start at 0px"></div>
                    <div class="slot end-slot" aria-label={`End at ${travel}px`}></div>
                    <div class="rail"></div>
                    <motion.div class="card generated-card" style={{ x }}>
                        <small>without template</small>
                        <strong>straight</strong>
                    </motion.div>
                </div>
            </section>

            <section class="lane template-lane">
                <div class="lane-head">
                    <span>transformTemplate</span>
                    <strong>lift + rotate + generated</strong>
                </div>
                <div class="track">
                    <div class="slot start-slot" aria-label="Generated transform starts here"></div>
                    <div class="slot end-slot" aria-label="Final transform lands here"></div>
                    <div class="template-field" aria-hidden="true"></div>
                    <div class="rail highlighted"></div>
                    <motion.div
                        class="card template-card"
                        data-state={state}
                        style={{ x }}
                        {transformTemplate}
                    >
                        <small>with template</small>
                        <strong>{state === 'end' ? 'rewritten' : 'composed'}</strong>
                    </motion.div>
                </div>
            </section>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(560px, calc(100vh - 160px), 640px);
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
        gap: 14px;
        padding: 18px 26px;
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
        align-self: stretch;
        height: 100%;
        min-height: 0;
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
            radial-gradient(circle at 20% 72%, rgba(45, 212, 191, 0.16), transparent 28%),
            radial-gradient(circle at 80% 30%, rgba(251, 113, 133, 0.15), transparent 32%);
        pointer-events: none;
    }

    .intro {
        position: absolute;
        top: 22px;
        left: 28px;
        right: 28px;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 12px;
    }

    .intro span,
    .lane-head span {
        color: #67e8f9;
        font-size: 11px;
        font-weight: 850;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    .intro strong {
        max-width: 620px;
        color: #ecfeff;
        font-size: 18px;
        line-height: 1.1;
        text-align: left;
    }

    .comparison {
        position: absolute;
        inset: 76px 28px 28px;
        display: grid;
        grid-template-rows: repeat(2, minmax(0, 1fr));
        gap: 14px;
    }

    .lane {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 10px;
        padding: 18px 22px 16px;
        border: 1px solid rgba(134, 184, 199, 0.42);
        background: rgba(13, 27, 33, 0.74);
    }

    .lane-head {
        z-index: 3;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        min-height: 32px;
    }

    .lane-head strong {
        color: #ecfeff;
        font-size: clamp(16px, 1.55vw, 21px);
        line-height: 1.05;
        text-align: right;
    }

    .track {
        --card-width: 158px;
        position: relative;
        width: calc(var(--card-width) + 700px);
        max-width: 100%;
        min-height: 122px;
        margin: 0 auto;
        overflow: visible;
    }

    .rail {
        position: absolute;
        left: calc(var(--card-width) / 2);
        right: calc(var(--card-width) / 2);
        bottom: 34px;
        height: 2px;
        background: rgba(186, 230, 253, 0.38);
    }

    .rail::before,
    .rail::after {
        content: '';
        position: absolute;
        top: 50%;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(186, 230, 253, 0.65);
        border-radius: 999px;
        background: #071114;
        transform: translateY(-50%);
    }

    .rail::before {
        left: 0;
    }

    .rail::after {
        right: 0;
    }

    .rail.highlighted {
        background: linear-gradient(90deg, #5eead4, #38bdf8, #fb7185);
        box-shadow: 0 0 28px rgba(56, 189, 248, 0.32);
    }

    .slot {
        position: absolute;
        bottom: 16px;
        width: var(--card-width);
        height: 88px;
        border: 1px dashed rgba(134, 184, 199, 0.22);
        background: rgba(7, 17, 20, 0.28);
    }

    .slot.start-slot {
        left: 0;
    }

    .slot.end-slot {
        right: 0;
    }

    .template-field {
        position: absolute;
        inset: 0 0 10px;
        border: 1px dashed rgba(94, 234, 212, 0.28);
        background:
            radial-gradient(ellipse at 50% 30%, rgba(56, 189, 248, 0.18), transparent 34%),
            radial-gradient(ellipse at 60% 72%, rgba(251, 113, 133, 0.12), transparent 34%);
    }

    :global(.card) {
        position: absolute;
        left: 0;
        bottom: 48px;
        z-index: 4;
        width: var(--card-width);
        min-height: 64px;
        display: grid;
        align-content: center;
        gap: 5px;
        padding: 0 16px;
        border: 1px solid rgba(186, 230, 253, 0.52);
        border-radius: 10px;
        color: #ecfeff;
        transform-origin: 50% 50%;
    }

    :global(.card small) {
        font-size: 10px;
        font-weight: 850;
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }

    :global(.card strong) {
        font-size: 20px;
        line-height: 1;
        text-transform: uppercase;
    }

    :global(.generated-card) {
        background: rgba(30, 41, 59, 0.9);
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.32);
    }

    :global(.generated-card small) {
        color: #cbd5e1;
    }

    :global(.template-card) {
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.98), rgba(14, 116, 144, 0.98));
        box-shadow: 0 26px 90px rgba(45, 212, 191, 0.34);
    }

    :global(.template-card small) {
        color: #b5f5eb;
    }

    :global(.template-card[data-state='end']) {
        background: linear-gradient(135deg, rgba(251, 113, 133, 0.98), rgba(168, 85, 247, 0.98));
        box-shadow: 0 26px 90px rgba(251, 113, 133, 0.34);
    }

    @media (max-width: 900px) {
        .dk-demo-shell {
            padding: 1rem;
        }

        .intro {
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
        }

        .intro strong {
            max-width: 100%;
            text-align: left;
        }

        .comparison {
            inset: 120px 18px 18px;
        }

        .lane {
            padding: 14px 14px 12px;
        }

        .lane-head {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
        }

        .lane-head strong {
            font-size: 17px;
            text-align: left;
        }

        .track {
            --card-width: 136px;
            width: calc(var(--card-width) + 540px);
        }

        :global(.card) {
            bottom: 36px;
            min-height: 60px;
            padding: 0 14px;
        }

        :global(.card strong) {
            font-size: 18px;
        }
    }
</style>
