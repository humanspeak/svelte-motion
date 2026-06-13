<script lang="ts">
    import { motion, createDragControls } from '$lib'
    const controls = createDragControls()
    const initialControls = createDragControls()
    function start(e: PointerEvent) {
        controls.start(e, { snapToCursor: true })
    }
    function startInitial(e: PointerEvent) {
        initialControls.start(e, { snapToCursor: true })
    }
</script>

<div style="height: 360px; display: grid; place-items: center; gap: 24px;">
    <section style="display: grid; place-items: center; gap: 8px;">
        <button onpointerdown={start} data-testid="handle">Start Drag</button>
        <motion.div
            drag="x"
            dragControls={controls}
            dragListener={false}
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
            data-testid="drag-controls-initial"
            style="width:80px;height:80px;background:#38bdf8;border-radius:8px;"
        />
    </section>
</div>
