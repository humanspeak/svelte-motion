<script lang="ts">
    import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from '@lucide/svelte'
    import {
        animate,
        motion,
        useMotionValue,
        useTransform,
        type TransformTemplate
    } from '@humanspeak/svelte-motion'

    const travel = 700
    const progress = useMotionValue(0)
    const x = useTransform(progress, [0, 1], [0, travel])

    let state = $state<'start' | 'moving' | 'end'>('start')
    let activeAnimation: { stop: () => void } | null = null
    let runId = 0

    const transformTemplate: TransformTemplate = ({ x }, generated) => {
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
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// transform-template</span>
            <span class="micro state">state: {state}</span>
        </div>

        <div class="toolbar" aria-label="Transform template controls">
            <button type="button" class="ctrl" onclick={() => moveTo(0)}>
                <ArrowLeft size={14} />
                Back
            </button>
            <button type="button" class="ctrl primary" onclick={() => moveTo(1)}>
                <Sparkles size={14} />
                Apply template
                <ArrowRight size={14} />
            </button>
            <button type="button" class="ctrl" onclick={reset}>
                <RotateCcw size={14} />
                Reset
            </button>
        </div>

        <div class="comparison" aria-label="Generated transform compared with transformTemplate">
            <section class="lane">
                <div class="lane-head">
                    <span class="micro">// generated</span>
                    <span class="micro">straight transform</span>
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

            <section class="lane">
                <div class="lane-head">
                    <span class="micro">// transformtemplate</span>
                    <span class="micro">lift + rotate + generated</span>
                </div>
                <div class="track">
                    <div class="slot start-slot" aria-label="Generated transform starts here"></div>
                    <div class="slot end-slot" aria-label="Final transform lands here"></div>
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

        <div class="strip-foot">
            <span class="micro">same MotionValue x</span>
            <span class="micro">template rewrites the transform string</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 560px;
    }

    .strip {
        width: 100%;
        max-width: 720px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .state {
        color: var(--brut-accent, #247768);
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .ctrl {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.4rem 0.75rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: transparent;
        color: var(--brut-ink-2, #525252);
        cursor: pointer;
    }

    .ctrl.primary {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .comparison {
        display: grid;
        grid-template-rows: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
    }

    .lane {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 0.5rem;
        padding: 0.875rem 1rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    .lane-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
    }

    .track {
        --card-width: 150px;
        position: relative;
        width: calc(var(--card-width) + 700px);
        max-width: 100%;
        min-height: 112px;
        margin: 0 auto;
        overflow: visible;
    }

    .rail {
        position: absolute;
        left: calc(var(--card-width) / 2);
        right: calc(var(--card-width) / 2);
        bottom: 30px;
        height: 2px;
        background: var(--brut-rule-2, #bbc4c0);
    }

    .rail::before,
    .rail::after {
        content: '';
        position: absolute;
        top: 50%;
        width: 10px;
        height: 10px;
        border: 2px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
        transform: translateY(-50%);
    }

    .rail::before {
        left: 0;
    }

    .rail::after {
        right: 0;
    }

    .rail.highlighted {
        background: var(--brut-accent, #247768);
    }

    .rail.highlighted::before,
    .rail.highlighted::after {
        border-color: var(--brut-accent, #247768);
    }

    .slot {
        position: absolute;
        bottom: 12px;
        width: var(--card-width);
        height: 84px;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        background: transparent;
    }

    .slot.start-slot {
        left: 0;
    }

    .slot.end-slot {
        right: 0;
    }

    :global(.dk-demo-shell .card) {
        position: absolute;
        left: 0;
        bottom: 42px;
        z-index: 4;
        width: var(--card-width);
        min-height: 60px;
        display: grid;
        align-content: center;
        gap: 5px;
        padding: 0 14px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        transform-origin: 50% 50%;
    }

    :global(.dk-demo-shell .card small) {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    :global(.dk-demo-shell .card strong) {
        font-family: var(--brut-mono, monospace);
        font-size: 1.125rem;
        line-height: 1;
        text-transform: uppercase;
    }

    :global(.dk-demo-shell .generated-card) {
        background: var(--brut-bg, #f8fcfb);
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
    }

    :global(.dk-demo-shell .generated-card small) {
        color: var(--brut-ink-3, #9a9a9a);
    }

    :global(.dk-demo-shell .generated-card strong) {
        color: var(--brut-ink, #0a0a0a);
    }

    :global(.dk-demo-shell .template-card) {
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
    }

    :global(.dk-demo-shell .template-card small) {
        color: var(--brut-accent, #247768);
    }

    :global(.dk-demo-shell .template-card strong) {
        color: var(--brut-accent, #247768);
    }

    :global(.dk-demo-shell .template-card[data-state='end']) {
        background: var(--brut-accent, #247768);
        border-color: var(--brut-accent, #247768);
    }

    :global(.dk-demo-shell .template-card[data-state='end'] small),
    :global(.dk-demo-shell .template-card[data-state='end'] strong) {
        color: var(--brut-accent-ink, #f8fcfb);
    }

    @media (max-width: 900px) {
        .track {
            --card-width: 132px;
            width: calc(var(--card-width) + 540px);
        }
    }
</style>
