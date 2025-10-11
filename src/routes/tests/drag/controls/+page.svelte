<script lang="ts">
    import { motion, createDragControls } from '$lib'
    const controls = createDragControls()
    function start(e: PointerEvent) {
        controls.start(e, { snapToCursor: true })
    }
</script>

<div style="height: 300px; display: grid; place-items: center">
    <button on:pointerdown={start} data-testid="handle">Start Drag</button>
    <motion.div
        drag="x"
        dragControls={controls}
        dragListener={false}
        data-testid="drag-controls"
        style="width:100px;height:100px;background:#ef4444;border-radius:8px;"
    />
</div>
