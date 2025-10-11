<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="height: 300px; display: grid; place-items: center; position: relative">
    <!-- Horizontal guide line to indicate X axis -->
    <div
        data-testid="axis-guide"
        style="position:absolute; top: 50%; left: calc(50% - 50vw); width: 100vw; height: 0; border-top: 2px dashed #888; opacity: 0.6; pointer-events: none; z-index: 0;"
    />
    <motion.div
        drag="x"
        data-testid="drag-x"
        style="position: relative; z-index: 1; width:100px;height:100px;background:#60a5fa;border-radius:8px;"
    />
</div>
