<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="height: 320px; display: grid; place-items: center">
    <motion.div
        drag
        data-testid="drag-momentum"
        style="width:100px;height:100px;background:#22d3ee;border-radius:8px;"
    />
</div>



