<script lang="ts">
    /**
     * Regression for a final pointermove that lands in the same frame as
     * pointerup. Browsers flush a coalesced pointermove immediately before
     * pointerup, so the last move can still be waiting for a frame when the
     * release arrives. The element must come to rest at the release point,
     * matching `onDragEnd`'s reported offset (Motion 13.4.5 parity, upstream
     * Cypress `drag-release-before-frame`).
     */
    import { motion } from '$lib'

    let offset = $state('')
</script>

<div style="padding: 100px">
    <motion.div
        drag
        dragElastic={0}
        dragMomentum={false}
        data-testid="draggable"
        onDragEnd={(_, info) => (offset = `${info.offset.x},${info.offset.y}`)}
        style="width:50px;height:50px;background:red"
    />
    <!-- Fixed size: the test layout centers this block, so a readout that
         grew when filled would shift the draggable's resting rect. -->
    <div id="drag-end-offset" style="width:50px;height:24px;white-space:nowrap">{offset}</div>
</div>
