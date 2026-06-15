<script lang="ts">
    import { motion, AnimatePresence, MotionConfig } from '$lib'

    let isVisible = $state(true)

    function toggleVisibility() {
        isVisible = !isVisible
    }

    const isPlaywright =
        typeof window !== 'undefined' && window.location.search.includes('@isPlaywright=true')

    // Keep the Playwright path deterministic for the existing timing specs.
    const demoTransition = isPlaywright
        ? { duration: 1 }
        : { type: 'spring' as const, stiffness: 300, damping: 25 }
</script>

<div class="relative flex h-40 w-24 flex-col">
    <MotionConfig transition={{ duration: 0.6 }}>
        <AnimatePresence initial={!isPlaywright}>
            {#if isVisible}
                <motion.div
                    key="box"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={demoTransition}
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
    </MotionConfig>
</div>
