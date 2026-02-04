<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    import { svgProps, animations, secondLineAnimation } from './constants'
</script>

<motion.svg {...svgProps}>
    <motion.line x1="6" y1="6" x2="18" y2="18" {...animations} />
    <motion.line x1="18" y1="6" x2="6" y2="18" {...secondLineAnimation} />
</motion.svg>
