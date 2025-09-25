<script lang="ts">
    import { motion } from '$lib/index'
</script>

<motion.button
    whileHover={{ opacity: 0 }}
    transition={{ duration: 1 }}
    style="width: 100px; height: 100px; background-color: #9911ff; border-radius: 5px;"
    data-testid="motion-hover-opacity"
>
    Hover opacity
</motion.button>
