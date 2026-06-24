<script lang="ts">
    import { Gauge, RotateCcw, Zap } from '@lucide/svelte'
    import { motion } from '@humanspeak/svelte-motion'

    // A high-frequency render driver: every tick recolors both boxes, forcing
    // a re-render. Without `layoutDependency`, that re-renders the layout box
    // AND re-measures it every single time.
    let tick = $state(0)
    let dep = $state(0)
    let shifted = $state(false)
    let defaultMeasures = $state(0)
    let gatedMeasures = $state(0)
    let auto = $state(false)

    const hue = $derived(tick % 360)
    const boxStyle = $derived(`background: hsl(${hue} 85% 62%)`)

    function reflow() {
        shifted = !shifted
        tick += 1
        dep += 1
    }

    function reset() {
        defaultMeasures = 0
        gatedMeasures = 0
    }

    $effect(() => {
        if (!auto) return
        const id = setInterval(() => (tick += 1), 90)
        return () => clearInterval(id)
    })
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="layoutDependency controls">
        <button type="button" class:active={auto} onclick={() => (auto = !auto)}>
            <Zap size={15} />
            {auto ? 'Stop renders' : 'Start renders'}
        </button>
        <button type="button" class="primary" onclick={reflow}>
            <Gauge size={15} />
            Reflow + bump dep
        </button>
        <button type="button" onclick={reset}>
            <RotateCcw size={15} />
            Reset counters
        </button>
    </div>

    <div class="lanes" class:shifted>
        <section class="lane">
            <header>
                <span>no gate</span>
                <strong>re-measures every render</strong>
            </header>
            <p class="count" data-state={defaultMeasures > 0 ? 'busy' : 'idle'}>
                {defaultMeasures} measures
            </p>
            <div class="track">
                <motion.div
                    class="box"
                    layout
                    style={boxStyle}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    onProjectionUpdate={() => (defaultMeasures += 1)}
                >
                    A
                </motion.div>
            </div>
        </section>

        <section class="lane gated">
            <header>
                <span>layoutDependency</span>
                <strong>measures only on dep change</strong>
            </header>
            <p class="count" data-state={gatedMeasures > 0 ? 'busy' : 'idle'}>
                {gatedMeasures} measures
            </p>
            <div class="track">
                <motion.div
                    class="box"
                    layout
                    layoutDependency={dep}
                    style={boxStyle}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    onProjectionUpdate={() => (gatedMeasures += 1)}
                >
                    B
                </motion.div>
            </div>
        </section>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(520px, calc(100vh - 160px), 600px);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 16px;
        padding: 20px 26px;
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

    button.active {
        border-color: #fbbf24;
        background: #422006;
    }

    .lanes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        min-height: 0;
    }

    .lane {
        position: relative;
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        gap: 12px;
        padding: 18px 22px;
        border: 1px solid rgba(134, 184, 199, 0.42);
        background: rgba(7, 17, 20, 0.55);
        overflow: hidden;
    }

    .lane.gated {
        border-color: rgba(94, 234, 212, 0.5);
    }

    header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
    }

    header span {
        color: #67e8f9;
        font-size: 11px;
        font-weight: 850;
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }

    header strong {
        color: #ecfeff;
        font-size: 15px;
        text-align: right;
    }

    .count {
        margin: 0;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 26px;
        font-weight: 850;
        color: #64748b;
        transition: color 0.2s ease;
    }

    .count[data-state='busy'] {
        color: #5eead4;
    }

    .track {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 10px;
        border: 1px dashed rgba(134, 184, 199, 0.22);
        min-height: 0;
    }

    .shifted .track {
        justify-content: flex-end;
    }

    :global(.box) {
        width: 84px;
        height: 84px;
        display: grid;
        place-items: center;
        border-radius: 20px;
        color: #031316;
        font-size: 22px;
        font-weight: 900;
    }

    @media (max-width: 760px) {
        .lanes {
            grid-template-columns: 1fr;
        }
    }
</style>
