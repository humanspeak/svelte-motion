<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="height: 300px; display: grid; place-items: center">
    <motion.div
        drag="y"
        data-testid="drag-y"
        style="width:100px;height:100px;background:#34d399;border-radius:8px;"
    />
</div>



