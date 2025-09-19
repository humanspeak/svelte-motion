<script lang="ts">
    import { motion, useSpring, useTime, useTransform } from '$lib/index'

    const time = useTime()

    // Rotating animation
    const rotate = useTransform(time, [0, 3000], [0, 360], {
        clamp: false
    })
    const rotatingBg = useTransform(
        () => `conic-gradient(from ${$rotate}deg, #ff4545, #00ff99, #006aff, #ff0095, #ff4545)`,
        [rotate]
    )

    // Time-driven blur amplitude target (0 → 4px) over 2s
    const pulseTarget = useTransform(() => {
        const phase = ($time % 2000) / 2000
        const normalized = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2) // 0..1
        return 4 * normalized // 0..4 px
    }, [time])
    // Spring follows target for a smooth pulse
    const pulse = useSpring(pulseTarget, { stiffness: 120, damping: 18 })
    const pulsingBg = useTransform(() => `blur(${$pulse}px)`, [pulse])
</script>

<div class="bg-primary flex h-full w-full flex-col items-center justify-center">
    <div class="relative mb-6">
        <button
            class="bg-primary hover:bg-primary/80 relative z-10 rounded-md px-3 py-2 text-white transition-colors duration-200"
        >
            @humanspeak/svelte-motion (animated border)
        </button>
        <motion.div
            data-rotate-value={$rotate}
            data-time-value={$time}
            data-testid="rotating-bg"
            class="absolute -inset-0.5 rounded-md"
            style={`background: ${$rotatingBg}; filter: brightness(0.3)`}
        />
    </div>
    <div class="relative">
        <button
            class="bg-primary hover:bg-primary/80 relative z-10 rounded-md px-3 py-2 text-white transition-colors duration-200"
        >
            @humanspeak/svelte-motion (pulsing border)
        </button>
        <div
            class="absolute -inset-0.5 rounded-md"
            style="background: conic-gradient(#ff4545, #00ff99, #006aff, #ff0095, #ff4545)"
        ></div>
        <motion.div
            data-pulse-value={$pulse}
            data-testid="rotating-bg-pulse"
            layout
            class="absolute -inset-0.5 rounded-md"
            style={`background: conic-gradient(#ff4545, #00ff99, #006aff, #ff0095, #ff4545); filter: brightness(0.3) ${$pulsingBg}`}
        />
    </div>
</div>
