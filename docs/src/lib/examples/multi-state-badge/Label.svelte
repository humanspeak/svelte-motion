<script lang="ts">
    import { motion, AnimatePresence, styleString } from '@humanspeak/svelte-motion'
    import { STATES, SPRING_CONFIG, type BadgeState } from './constants'

    type Props = {
        badgeState: BadgeState
    }

    const { badgeState }: Props = $props()

    let labelWidth = $state(0)
    let measureElement: HTMLDivElement | null = $state(null)

    // Measure label width when state changes
    $effect(() => {
        // Access badgeState to create reactive dependency
        void badgeState
        if (measureElement) {
            const { width } = measureElement.getBoundingClientRect()
            labelWidth = width
        }
    })
</script>

<!-- Hidden copy of label to measure width -->
<div
    bind:this={measureElement}
    style={styleString(() => ({
        position: 'absolute',
        visibility: 'hidden',
        whiteSpace: 'nowrap'
    }))}
>
    {STATES[badgeState]}
</div>

<motion.span
    layout
    style={styleString(() => ({
        position: 'relative'
    }))}
    animate={{
        width: labelWidth
    }}
    transition={SPRING_CONFIG}
>
    <!-- Note: AnimatePresence mode="sync" not yet implemented -->
    <AnimatePresence initial={false}>
        <motion.div
            key={badgeState}
            data-debug="label-motion"
            style={styleString(() => ({
                textWrap: 'nowrap'
            }))}
            initial={{
                y: -20,
                opacity: 0,
                filter: 'blur(10px)',
                position: 'absolute'
            }}
            animate={{
                y: 0,
                opacity: 1,
                filter: 'blur(0px)',
                position: 'relative'
            }}
            exit={{
                y: 20,
                opacity: 0,
                filter: 'blur(10px)',
                position: 'absolute'
            }}
            transition={{
                duration: 0.2,
                ease: 'easeInOut'
            }}
        >
            {STATES[badgeState]}
        </motion.div>
    </AnimatePresence>
</motion.span>
