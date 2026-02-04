<script lang="ts">
    import { motion, useTime, useTransform, styleString } from '@humanspeak/svelte-motion'
    import { ICON_SIZE, svgProps, animations } from './constants'

    const time = useTime()
    const rotate = useTransform(time, [0, 1000], [0, 360], { clamp: false })
</script>

<motion.div
    style={styleString(() => ({
        rotate: $rotate,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: ICON_SIZE,
        height: ICON_SIZE
    }))}
>
    <motion.svg {...svgProps}>
        <motion.path d="M21 12a9 9 0 1 1-6.219-8.56" {...animations} />
    </motion.svg>
</motion.div>
