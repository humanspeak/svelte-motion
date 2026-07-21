<script lang="ts">
    import { Gauge, RotateCcw, Zap } from '@lucide/svelte'
    import { motion, styleString } from '@humanspeak/svelte-motion'

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

    // The hsl recolor is the render-driver visualization — every tick paints a
    // new hue, forcing the re-render that exercises layout measurement.
    const boxStyle = $derived(
        styleString(() => ({
            width: '84px',
            height: '84px',
            display: 'grid',
            placeItems: 'center',
            border: '1px solid var(--brut-ink, #0a0a0a)',
            background: `hsl(${hue} 85% 62%)`,
            color: 'var(--brut-ink, #0a0a0a)',
            fontFamily: 'var(--brut-mono, monospace)',
            fontSize: '22px',
            fontWeight: 700
        }))
    )

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
                <span>// no gate</span>
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
                <span>// layoutDependency</span>
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

    button.active {
        border-color: var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
        color: var(--brut-accent-ink, #f8fcfb);
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
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        overflow: hidden;
    }

    .lane.gated {
        border-color: var(--brut-accent, #247768);
    }

    header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
    }

    header span {
        color: var(--brut-accent, #247768);
        font-family: var(--brut-mono, monospace);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    header strong {
        color: var(--brut-ink, #0a0a0a);
        font-size: 15px;
        text-align: right;
    }

    .count {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 26px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .count[data-state='busy'] {
        color: var(--brut-accent, #247768);
    }

    .track {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 10px;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        min-height: 0;
    }

    .shifted .track {
        justify-content: flex-end;
    }

    @media (max-width: 760px) {
        .lanes {
            grid-template-columns: 1fr;
        }
    }
</style>
