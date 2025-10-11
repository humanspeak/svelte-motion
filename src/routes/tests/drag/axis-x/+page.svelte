<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="height: 300px; display: grid; place-items: center">
    <motion.div
        drag="x"
        data-testid="drag-x"
        style="width:100px;height:100px;background:#60a5fa;border-radius:8px;"
    />
</div>
