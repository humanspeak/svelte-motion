<script lang="ts">
    import { motion, useTime, useTransform } from '$lib/index.js'

    const time = useTime()

    // Rotating animation
    const rotate = useTransform(time, [0, 3000], [0, 360], {
        clamp: false
    })
    const rotatingBg = useTransform(
        () => `conic-gradient(from ${$rotate}deg, #ff4545, #00ff99, #006aff, #ff0095, #ff4545)`,
        [rotate]
    )
</script>

<div class="relative">
    <button
        class="bg-primary hover:bg-primary/80 relative z-10 rounded-md px-3 py-2 text-white transition-colors duration-200"
    >
        @humanspeak/svelte-motion
    </button>
    <motion.div
        data-rotate-value={$rotate}
        data-time-value={$time}
        class="absolute -inset-0.5 rounded-md"
        style={`background: ${$rotatingBg}`}
    />
</div>
