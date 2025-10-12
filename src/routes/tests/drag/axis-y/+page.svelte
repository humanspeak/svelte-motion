<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="height: 300px; display: grid; place-items: center; position: relative">
    <!-- Vertical guide line to indicate Y axis -->
    <div
        data-testid="axis-guide"
        style="position:absolute; left: 50%; top: calc(50% - 50vh); height: 100vh; width: 0; border-left: 2px dashed #888; opacity: 0.6; pointer-events: none; z-index: 0;"
    ></div>
    <motion.div
        drag="y"
        data-testid="drag-y"
        style="position: relative; z-index: 1; width:100px;height:100px;background:#34d399;border-radius:8px;"
    />
</div>
