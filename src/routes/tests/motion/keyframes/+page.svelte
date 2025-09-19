<script lang="ts">
    import { motion } from '$lib/index.js'
</script>

<motion.div
    animate={{
        scale: [1, 2, 2, 1, 1],
        rotate: [0, 0, 180, 180, 0],
        borderRadius: ['0%', '0%', '50%', '50%', '0%']
    }}
    transition={{
        duration: 2,
        ease: 'easeInOut',
        times: [0, 0.2, 0.5, 0.8, 1],
        repeat: Infinity,
        repeatDelay: 1
    }}
    style="width: 100px; height: 100px; background-color: pink; border-radius: 5px;"
    data-testid="motion-keyframes"
/>
