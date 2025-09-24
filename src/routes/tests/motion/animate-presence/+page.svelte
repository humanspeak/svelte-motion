<script lang="ts">
    import { motion, AnimatePresence } from '$lib/index'

    let isVisible = $state(true)

    function toggleVisibility() {
        isVisible = !isVisible
    }

    const isPlaywright =
        typeof window !== 'undefined' &&
        window.location.search.includes('@humanspeak-svelte-motion-isPlaywright=true')

    // Use seconds; duration must be in the transition prop, not keyframes
    // trunk-ignore(eslint/@typescript-eslint/no-unused-vars,eslint/no-unused-vars)
    const _testTransition = isPlaywright ? { duration: 5 } : undefined
</script>

<div class="relative flex h-40 w-24 flex-col">
    <AnimatePresence>
        {#if isVisible}
            <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                class="size-24 rounded-lg bg-cyan-400"
                data-testid="box"
            />
        {/if}
    </AnimatePresence>

    <motion.button
        onclick={toggleVisibility}
        whileTap={{ y: 1 }}
        class="absolute right-0 bottom-0 left-0 cursor-pointer rounded-lg border-none bg-cyan-400 px-5 py-2.5 text-gray-900 hover:bg-cyan-500"
        data-testid="toggle"
    >
        {isVisible ? 'Hide' : 'Show'}
    </motion.button>
</div>
