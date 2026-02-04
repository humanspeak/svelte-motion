<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    import { svgProps, animations } from './constants'
</script>

<motion.svg {...svgProps}>
    <motion.polyline points="4 12 9 17 20 6" {...animations} />
</motion.svg>
