<script lang="ts">
    import { motion } from '$lib/index'
</script>

<motion.div
    whileHover={{ scale: 1.2 }}
    whileTap={{ scale: 0.8 }}
    style="width: 100px; height: 100px; background-color: #9911ff; border-radius: 5px;"
    data-testid="motion-hover-and-tap"
/>
