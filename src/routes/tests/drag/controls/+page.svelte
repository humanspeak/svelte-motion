<script lang="ts">
    /**
     * `dragControls` fixtures: each box is dragged from its button, never from
     * the box itself (`dragListener={false}`).
     *
     * - Red, "Start Drag": `drag="x"` with `snapToCursor`.
     * - Blue, "Start Initial Drag": both axes with `snapToCursor`, starting at
     *   `initial={{ x: 100, y: 40 }}`.
     * - Green, "Start Immediate Drag": `immediate`, so a press with no move
     *   still starts and ends a drag.
     *
     * Driven by `e2e/drag/controls.spec.ts`, which pins the pixel layout of the
     * red and blue sections: keep the button labels and box sizes as they are.
     */
    import { motion, createDragControls } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    const controls = createDragControls()
    const initialControls = createDragControls()
    const immediateControls = createDragControls()
    // onDragStart/onDragEnd mirrors for the e2e drag-start signal.
    let dragStarts = $state(0)
    let dragging = $state(false)
    let initialDragStarts = $state(0)
    let initialDragging = $state(false)
    function start(e: PointerEvent) {
        controls.start(e, { snapToCursor: true })
    }
    function startInitial(e: PointerEvent) {
        initialControls.start(e, { snapToCursor: true })
    }
    // `immediate` mode (Motion 14.10): the drag starts on pointerdown, without
    // waiting for the pointer to move, so a press and release with no move
    // still fires onDragStart and onDragEnd once each.
    let immediateStarts = $state(0)
    let immediateEnds = $state(0)
    function startImmediate(e: PointerEvent) {
        immediateControls.start(e, { immediate: true })
    }

    const steps: TesterStep[] = [
        {
            text: 'Press Start Drag near its left edge and hold.',
            expected:
                "On press the red box slides left so its centre lines up with the pointer's x. snapToCursor snaps when the press starts, before any move, as upstream does. It moves on x only, so it stays below the button."
        },
        {
            text: 'Still holding, move about 2px and let go.',
            expected:
                'Nothing more happens and Red drags stays at 0: 2px is under the 3px drag threshold, so no drag starts.'
        },
        {
            text: 'Press Start Drag again and drag right, then up and down.',
            expected:
                'Once you pass 3px Red drags goes up by 1 and the box follows the pointer left and right. Moving up or down does not move it.'
        },
        {
            text: 'Press Start Initial Drag (above the blue box), drag anywhere and let go. Repeat a few times.',
            expected:
                'The blue box starts offset 100px right and 40px down. On each press it jumps so its centre is under the pointer on both axes (up onto the button), then follows. It never lands a little further off each time.'
        },
        {
            text: 'Press and release Start Immediate Drag (bottom left) without moving.',
            expected: 'The green box stays put, and starts and ends each go up by 1.'
        }
    ]
</script>

<svelte:head>
    <title>Drag controls</title>
</svelte:head>

<div style="height: 360px; display: grid; place-items: center; gap: 24px;">
    <section style="display: grid; place-items: center; gap: 8px;">
        <button onpointerdown={start} data-testid="handle">Start Drag</button>
        <motion.div
            drag="x"
            dragControls={controls}
            dragListener={false}
            onDragStart={() => {
                dragStarts += 1
                dragging = true
            }}
            onDragEnd={() => (dragging = false)}
            data-drag-start-count={dragStarts}
            data-dragging={dragging}
            data-testid="drag-controls"
            style="width:100px;height:100px;background:#ef4444;border-radius:8px;"
        />
    </section>
    <section style="display: grid; place-items: center; gap: 8px;">
        <button onpointerdown={startInitial} data-testid="initial-handle">
            Start Initial Drag
        </button>
        <motion.div
            drag
            dragControls={initialControls}
            dragListener={false}
            dragMomentum={false}
            initial={{ x: 100, y: 40 }}
            onDragStart={() => {
                initialDragStarts += 1
                initialDragging = true
            }}
            onDragEnd={() => (initialDragging = false)}
            data-drag-start-count={initialDragStarts}
            data-dragging={initialDragging}
            data-testid="drag-controls-initial"
            style="width:80px;height:80px;background:#38bdf8;border-radius:8px;"
        />
    </section>
</div>
<!-- Fixed, out of flow: the pixel-exact layout of the two sections above must not move. -->
<section
    style="position: fixed; left: 16px; bottom: 16px; display: grid; place-items: center; gap: 8px;"
>
    <button onpointerdown={startImmediate} data-testid="immediate-handle">
        Start Immediate Drag
    </button>
    <motion.div
        drag="x"
        dragControls={immediateControls}
        dragListener={false}
        dragMomentum={false}
        onDragStart={() => (immediateStarts += 1)}
        onDragEnd={() => (immediateEnds += 1)}
        data-testid="drag-controls-immediate"
        style="width:60px;height:60px;background:#a3e635;border-radius:8px;"
    />
    <p>
        starts: <span data-testid="immediate-start">{immediateStarts}</span> · ends:
        <span data-testid="immediate-end">{immediateEnds}</span>
    </p>
</section>

<TesterPanel
    eyebrow="e2e/drag/controls.spec.ts"
    title="Drag controls"
    {steps}
    status="Covered by e2e/drag/controls.spec.ts."
>
    {#snippet checks()}
        <p>
            Each box is dragged only from its button: <code>dragControls.start(event)</code> with
            <code>dragListener=&#123;false&#125;</code>. <code>snapToCursor</code> centres the box
            under the pointer as soon as you press, before the drag threshold;
            <code>immediate</code> starts it on press, without waiting for a move.
        </p>
    {/snippet}
    {#snippet summary()}
        Red drags: <b>{dragStarts}</b> · Blue drags: <b>{initialDragStarts}</b> · Green:
        <b>{immediateStarts}/{immediateEnds}</b>
    {/snippet}
</TesterPanel>
