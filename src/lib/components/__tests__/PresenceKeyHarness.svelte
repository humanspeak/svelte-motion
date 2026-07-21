<script lang="ts">
    import { motion } from '$lib'
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'

    /**
     * Renders a motion element as a direct AnimatePresence child with a
     * caller-controlled `key`, so specs can exercise the direct-child key
     * validation — including falsy-but-valid keys like `0`.
     */
    let { key }: { key?: string | number } = $props()
</script>

<AnimatePresence>
    <motion.div {key} data-testid="presence-key-box">box</motion.div>
</AnimatePresence>
