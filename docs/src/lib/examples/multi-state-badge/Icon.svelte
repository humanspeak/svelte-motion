<script lang="ts">
    import { motion, AnimatePresence, styleString } from '@humanspeak/svelte-motion'
    import { SPRING_CONFIG, styles, type BadgeState } from './constants'
    import Check from './Check.svelte'
    import Loader from './Loader.svelte'
    import XIcon from './XIcon.svelte'

    type Props = {
        state: BadgeState
    }

    const { state: badgeState }: Props = $props()
</script>

<motion.span
    style={styleString(() => styles.iconContainer)}
    animate={{
        width: badgeState === 'idle' ? 0 : 20
    }}
    transition={SPRING_CONFIG}
>
    <AnimatePresence>
        <motion.span
            key={badgeState}
            data-debug="icon-motion"
            style={styleString(() => styles.icon)}
            initial={{
                y: -40,
                scale: 0.5,
                filter: 'blur(6px)'
            }}
            animate={{
                y: 0,
                scale: 1,
                filter: 'blur(0px)'
            }}
            exit={{
                y: 40,
                scale: 0.5,
                filter: 'blur(6px)'
            }}
            transition={{
                duration: 0.15,
                ease: 'easeInOut'
            }}
        >
            {#if badgeState === 'processing'}
                <Loader />
            {:else if badgeState === 'success'}
                <Check />
            {:else if badgeState === 'error'}
                <XIcon />
            {/if}
        </motion.span>
    </AnimatePresence>
</motion.span>
