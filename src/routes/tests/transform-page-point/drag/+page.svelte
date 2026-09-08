<script lang="ts">
    import { MotionConfig, createDragControls, motion, type DragInfo } from '$lib'
    import { onMount } from 'svelte'

    const controls = createDragControls()
    let board: HTMLElement | null = $state(null)
    let scaleX = $state(0.5)
    let scaleY = $state(0.5)
    let constraintMode = $state<'ref' | 'numeric'>('ref')
    let momentum = $state(false)
    let boardWidth = $state(520)
    let slotShift = $state(0)
    let localX = $state(0)
    let localY = $state(0)
    let pointX = $state(0)
    let pointY = $state(0)
    let velocityX = $state(0)
    let velocityY = $state(0)
    let ready = $state(false)

    // Stable callback identity: changing a zoom preset updates the values this
    // captured closure reads, which exercises live-scale session behavior.
    const transformPagePoint = ({ x, y }: { x: number; y: number }) => ({
        x: x / scaleX,
        y: y / scaleY
    })

    const record = (_event: PointerEvent, info: DragInfo) => {
        localX = info.offset.x
        localY = info.offset.y
        pointX = info.point.x
        pointY = info.point.y
        velocityX = info.velocity.x
        velocityY = info.velocity.y
    }

    const setScale = (x: number, y = x) => {
        scaleX = x
        scaleY = y
    }

    onMount(() => {
        ready = true
    })
</script>

<svelte:head><title>transformPagePoint drag test</title></svelte:head>

<main data-testid="drag-page" data-ready={ready}>
    <h1>transformPagePoint · drag</h1>
    <div class="controls">
        <button data-testid="zoom-50" onclick={() => setScale(0.5)}>50%</button>
        <button data-testid="zoom-100" onclick={() => setScale(1)}>100%</button>
        <button data-testid="zoom-200" onclick={() => setScale(2)}>200%</button>
        <button data-testid="zoom-nonuniform" onclick={() => setScale(0.5, 2)}>50% × 200%</button>
        <button data-testid="bounds-ref" onclick={() => (constraintMode = 'ref')}>ref bounds</button
        >
        <button data-testid="bounds-numeric" onclick={() => (constraintMode = 'numeric')}
            >numeric bounds</button
        >
        <button data-testid="toggle-momentum" onclick={() => (momentum = !momentum)}
            >momentum {momentum ? 'on' : 'off'}</button
        >
        <button
            data-testid="resize-bounds"
            onclick={() => (boardWidth = boardWidth === 520 ? 620 : 520)}>resize bounds</button
        >
        <button data-testid="shift-slot" onclick={() => (slotShift = slotShift === 0 ? 60 : 0)}
            >shift layout slot</button
        >
        <button
            data-testid="controls-start"
            onpointerdown={(event) => controls.start(event, { snapToCursor: true })}
            >snap handle</button
        >
    </div>

    <div class="viewport" data-testid="drag-viewport">
        <div
            class="scaled"
            data-testid="scaled-drag-board"
            style:transform={`scale(${scaleX}, ${scaleY})`}
        >
            <div
                class="board"
                bind:this={board}
                data-testid="drag-bounds"
                style:width={`${boardWidth}px`}
            >
                <div class="slot" style:translate={`${slotShift}px 0`}>
                    <MotionConfig {transformPagePoint}>
                        <motion.div
                            class="card"
                            data-testid="drag-card"
                            drag
                            dragConstraints={constraintMode === 'ref'
                                ? board
                                : { left: -180, right: 180, top: -80, bottom: 80 }}
                            dragElastic={0}
                            dragMomentum={momentum}
                            dragControls={controls}
                            layout
                            onDrag={record}
                            onDragEnd={record}>drag me</motion.div
                        >
                    </MotionConfig>
                </div>
            </div>
        </div>
    </div>

    <output
        data-testid="drag-output"
        data-local-x={localX}
        data-local-y={localY}
        data-point-x={pointX}
        data-point-y={pointY}
        data-velocity-x={velocityX}
        data-velocity-y={velocityY}
        data-scale-x={scaleX}
        data-scale-y={scaleY}
    >
        local {localX.toFixed(2)}, {localY.toFixed(2)}
    </output>
</main>

<style>
    main {
        min-height: 1200px;
        padding: 24px;
        font-family: system-ui;
    }
    .controls {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
        background: white;
    }
    button {
        padding: 7px 10px;
    }
    .viewport {
        width: 720px;
        height: 480px;
        overflow: auto;
        border: 2px solid #334155;
        padding: 40px;
    }
    .scaled {
        width: max-content;
        transform-origin: top left;
    }
    .board {
        height: 300px;
        display: grid;
        place-items: center;
        border: 4px dashed #38bdf8;
        background: #0f172a;
    }
    .slot {
        position: relative;
    }
    :global(.card) {
        width: 100px;
        height: 100px;
        display: grid;
        place-items: center;
        touch-action: none;
        user-select: none;
        background: #fbbf24;
        color: #111827;
        font-weight: 800;
        border-radius: 14px;
    }
    output {
        display: block;
        margin-top: 20px;
        font-variant-numeric: tabular-nums;
    }
</style>
