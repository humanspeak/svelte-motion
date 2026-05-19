<script lang="ts">
    import { motion } from '$lib'

    let { parentCustom = 1 }: { parentCustom?: number } = $props()

    // Child has no `custom` prop — must inherit from parent.
    const childVariants = {
        visible: (i: unknown) => ({ x: (i as number) * 25 })
    }

    const parentVariants = {
        visible: { opacity: 1 }
    }
</script>

<motion.div data-testid="parent" custom={parentCustom} variants={parentVariants} animate="visible">
    <motion.div data-testid="child" variants={childVariants} animate="visible" />
</motion.div>
