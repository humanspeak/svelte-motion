<script lang="ts">
    import { MotionConfig, motion, type DragInfo, type MotionTransformPoint } from '$lib'
    import { onMount } from 'svelte'

    let scale = $state(0.5)
    let mode = $state<'inherit' | 'override' | 'identity'>('inherit')
    let point = $state({ x: 0, y: 0 })
    let delta = $state({ x: 0, y: 0 })
    let offset = $state({ x: 0, y: 0 })
    let velocity = $state({ x: 0, y: 0 })
    let starts = $state(0)
    let ends = $state(0)
    let cancelled = $state(false)
    let ready = $state(false)

    const inherited: MotionTransformPoint = ({ x, y }) => ({ x: x / scale, y: y / scale })
    const override: MotionTransformPoint = ({ x, y }) => ({ x: x / 0.25, y: y / 0.25 })
    const identity: MotionTransformPoint = (value) => value
    const childTransform = $derived(
        mode === 'override' ? override : mode === 'identity' ? identity : undefined
    )

    const record = (event: PointerEvent, info: DragInfo) => {
        point = info.point
        delta = info.delta
        offset = info.offset
        velocity = info.velocity
        cancelled = event.type === 'pointercancel'
    }

    onMount(() => {
        ready = true
    })
</script>

<svelte:head><title>transformPagePoint pan test</title></svelte:head>

<main data-testid="pan-page" data-ready={ready}>
    <h1>transformPagePoint · pan</h1>
    <div class="controls">
        <button data-testid="pan-inherit" onclick={() => (mode = 'inherit')}>inherit</button>
        <button data-testid="pan-override" onclick={() => (mode = 'override')}>override 25%</button>
        <button data-testid="pan-identity" onclick={() => (mode = 'identity')}
            >identity reset</button
        >
        <button data-testid="pan-scale-50" onclick={() => (scale = 0.5)}>50%</button>
        <button data-testid="pan-scale-100" onclick={() => (scale = 1)}>100%</button>
        <button data-testid="pan-live-scale" onclick={() => (scale = scale === 0.5 ? 0.25 : 0.5)}
            >live scale</button
        >
        <button data-testid="pan-page-scroll" onclick={() => window.scrollBy(0, 80)}
            >page scroll</button
        >
    </div>

    <div class="scroll-shell" data-testid="pan-scroll-shell">
        <div class="scaled" style:transform={`scale(${scale})`} data-testid="scaled-pan-board">
            <MotionConfig transformPagePoint={inherited}>
                <MotionConfig transformPagePoint={childTransform}>
                    <motion.div
                        class="surface"
                        data-testid="pan-surface"
                        onPanSessionStart={() => {
                            starts += 1
                        }}
                        onPanStart={record}
                        onPan={record}
                        onPanEnd={(event, info) => {
                            record(event, info)
                            ends += 1
                        }}
                    >
                        <span
                            class="follower"
                            data-testid="pan-follower"
                            style:transform={`translate(${offset.x}px, ${offset.y}px)`}
                        ></span>
                        pan here
                    </motion.div>
                </MotionConfig>
            </MotionConfig>
        </div>
        <div class="spacer"></div>
    </div>

    <MotionConfig transformPagePoint={inherited}>
        <MotionConfig transformPagePoint={identity}>
            <motion.div class="identity-surface" data-testid="identity-pan" onPan={record}>
                explicit identity
            </motion.div>
        </MotionConfig>
    </MotionConfig>

    <output
        data-testid="pan-output"
        data-mode={mode}
        data-scale={scale}
        data-point-x={point.x}
        data-point-y={point.y}
        data-delta-x={delta.x}
        data-delta-y={delta.y}
        data-offset-x={offset.x}
        data-offset-y={offset.y}
        data-velocity-x={velocity.x}
        data-velocity-y={velocity.y}
        data-starts={starts}
        data-ends={ends}
        data-cancelled={cancelled}
    >
        offset {offset.x.toFixed(2)}, {offset.y.toFixed(2)}
    </output>
</main>

<style>
    main {
        min-width: 1600px;
        min-height: 1400px;
        padding: 24px;
        font-family: system-ui;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
    }
    button {
        padding: 7px 10px;
    }
    .scroll-shell {
        width: 620px;
        height: 360px;
        overflow: auto;
        border: 2px solid #475569;
        padding: 36px;
    }
    .scaled {
        width: 480px;
        transform-origin: top left;
    }
    :global(.surface),
    :global(.identity-surface) {
        position: relative;
        width: 420px;
        height: 220px;
        display: grid;
        place-items: center;
        overflow: hidden;
        touch-action: none;
        user-select: none;
        background: #172554;
        color: white;
        border: 4px solid #60a5fa;
    }
    .follower {
        position: absolute;
        left: 180px;
        top: 80px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #fb7185;
        pointer-events: none;
    }
    .spacer {
        width: 1000px;
        height: 700px;
    }
    :global(.identity-surface) {
        margin-top: 40px;
        width: 320px;
        height: 140px;
        background: #3f3f46;
    }
    output {
        display: block;
        margin-top: 20px;
        font-variant-numeric: tabular-nums;
    }
</style>
