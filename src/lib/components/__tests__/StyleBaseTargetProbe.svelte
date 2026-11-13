<script lang="ts">
    import { motion } from '$lib'
    import type { MotionProps } from '$lib/types'

    /**
     * One `data-testid="box"` `motion.div` whose `style` binds motion values,
     * for the `while*` base-target tests.
     */
    type Props = {
        style?: MotionProps['style']
        whileHover?: MotionProps['whileHover']
        whileTap?: MotionProps['whileTap']
        whileFocus?: MotionProps['whileFocus']
        transition?: MotionProps['transition']
        initial?: MotionProps['initial']
    }

    let { style, whileHover, whileTap, whileFocus, transition, initial }: Props = $props()
</script>

<motion.div data-testid="box" {style} {whileHover} {whileTap} {whileFocus} {transition} {initial} />
