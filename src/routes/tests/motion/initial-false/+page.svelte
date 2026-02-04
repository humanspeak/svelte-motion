<script lang="ts">
    import { motion } from '$lib'
</script>

<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        class="rounded-lg bg-purple-600 p-6 text-center"
        data-testid="initial-false-fade"
    >
        <div class="mb-2 text-4xl">🚀</div>
        <div class="text-sm">Appears Instantly</div>
    </motion.div>

    <motion.div
        initial={false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        class="rounded-lg bg-pink-600 p-6 text-center"
        data-testid="initial-false-scale"
    >
        <div class="mb-2 text-4xl">⚡</div>
        <div class="text-sm">No Mount Animation</div>
    </motion.div>

    <motion.div
        initial={false}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ duration: 0.5 }}
        class="rounded-lg bg-cyan-600 p-6 text-center"
        data-testid="initial-false-rotate"
    >
        <div class="mb-2 text-4xl">💫</div>
        <div class="text-sm">Skips Initial State</div>
    </motion.div>
</div>
