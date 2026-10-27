<script lang="ts">
    /**
     * Parent/child harness for the `transition.out` (#1725) runtime tests: the
     * child has only `variants`, so it inherits the parent's `initial`,
     * `animate` and `whileHover` labels.
     */
    import { motion } from '$lib/motion'
    import type { MotionAnimate, MotionInitial, MotionWhileHover, Variants } from '$lib/types'

    let {
        variants,
        initial,
        animate,
        whileHover
    }: {
        variants: Variants
        initial?: MotionInitial
        animate?: MotionAnimate
        whileHover?: MotionWhileHover
    } = $props()
</script>

<motion.div data-testid="parent" {variants} {initial} {animate} {whileHover}>
    <motion.div data-testid="child" {variants} />
</motion.div>
