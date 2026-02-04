<script lang="ts">
    import { motion, AnimatePresence } from '$lib/index'

    let isVisible = $state(true)
    let showNested = $state(true)

    function toggleVisibility() {
        isVisible = !isVisible
    }

    function toggleNested() {
        showNested = !showNested
    }

    const isPlaywright =
        typeof window !== 'undefined' && window.location.search.includes('@isPlaywright=true')

    const testTransition = isPlaywright ? { duration: 0.5 } : { duration: 0.3 }
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-900 p-8">
    <h1 class="text-2xl font-bold text-white">Nested Key Test</h1>
    <p class="max-w-md text-center text-gray-400">
        This test demonstrates that only direct children of AnimatePresence require keys. Nested
        motion elements can work without explicit keys.
    </p>

    <div class="flex gap-4">
        <button
            onclick={toggleVisibility}
            class="rounded-lg bg-cyan-500 px-4 py-2 text-gray-900 hover:bg-cyan-400"
            data-testid="toggle-main"
        >
            {isVisible ? 'Hide Card' : 'Show Card'}
        </button>
        <button
            onclick={toggleNested}
            class="rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-400"
            data-testid="toggle-nested"
        >
            {showNested ? 'Hide Nested' : 'Show Nested'}
        </button>
    </div>

    <div class="relative h-80 w-80">
        <AnimatePresence>
            {#if isVisible}
                <!-- Direct child MUST have key prop -->
                <motion.div
                    key="card"
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -20 }}
                    transition={testTransition}
                    class="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-6 shadow-xl"
                    data-testid="card"
                >
                    <h2 class="mb-4 text-xl font-semibold text-white">Card with Key</h2>

                    <!-- Nested motion element - NO key required! -->
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ ...testTransition, delay: 0.1 }}
                        class="mb-3 rounded-lg bg-white/20 p-3 text-white"
                        data-testid="nested-1"
                    >
                        Nested element 1 (no key)
                    </motion.div>

                    <!-- Another nested motion element - also no key -->
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ ...testTransition, delay: 0.2 }}
                        class="mb-3 rounded-lg bg-white/20 p-3 text-white"
                        data-testid="nested-2"
                    >
                        Nested element 2 (no key)
                    </motion.div>

                    <!-- Conditionally rendered nested element -->
                    {#if showNested}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={testTransition}
                            class="rounded-lg bg-purple-500/50 p-3 text-white"
                            data-testid="nested-conditional"
                        >
                            Conditional nested (no key)
                        </motion.div>
                    {/if}

                    <!-- Deeply nested motion element -->
                    <div class="mt-3">
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ ...testTransition, delay: 0.3 }}
                            class="text-sm text-white/70"
                            data-testid="deeply-nested"
                        >
                            Deeply nested span (no key)
                        </motion.span>
                    </div>
                </motion.div>
            {/if}
        </AnimatePresence>
    </div>

    <div class="mt-4 max-w-md rounded-lg bg-gray-800 p-4 text-sm text-gray-300">
        <h3 class="mb-2 font-semibold text-white">How it works:</h3>
        <ul class="list-inside list-disc space-y-1">
            <li>
                <code class="text-cyan-400">key="card"</code> - Required on direct child of AnimatePresence
            </li>
            <li>Nested motion elements work without explicit keys</li>
            <li>Exit animations still work for the entire tree</li>
            <li>Toggle "Hide Nested" to test conditional nested elements</li>
        </ul>
    </div>
</div>
