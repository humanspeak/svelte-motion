<script lang="ts">
    import { animate, useMotionValue, useTransform } from '@humanspeak/svelte-motion'
    import { interpolate } from 'flubber'
    import { onDestroy } from 'svelte'

    const lightning = 'M7 2v11h3v9l7-12h-4l4-8z'
    const hand =
        'M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z'
    const plane =
        'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z'
    const heart =
        'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
    const note =
        'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'
    const star =
        'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'

    // Lightning duplicated at end for seamless loop
    const paths = [lightning, hand, plane, heart, note, star, lightning]
    const colors = ['#fff312', '#ff0088', '#dd00ee', '#9911ff', '#0d63f8', '#0cdcf7', '#4ff0b7']

    // Pre-compute flubber interpolators once (expensive operation)
    const pathInterpolators = paths.map((p, i) => {
        if (i === paths.length - 1) return null // last→first not needed (we snap)
        return interpolate(p, paths[i + 1], { maxSegmentLength: 0.1 })
    })

    const progress = useMotionValue(0)

    const fill = useTransform(
        progress,
        paths.map((_, i) => i),
        colors
    )

    // Use function form — calls cheap pre-computed interpolator per frame
    const path = useTransform(() => {
        const v = progress.get()
        const i = Math.min(Math.floor(v), paths.length - 2)
        const t = v - i
        if (t < 0.001) return paths[Math.max(0, i)]
        const interp = pathInterpolators[i]
        if (!interp) return paths[i]
        return interp(t)
    }, [progress])

    let pathIndex = $state(0)
    let animation: ReturnType<typeof animate> | undefined

    $effect(() => {
        // Read pathIndex to subscribe
        const target = pathIndex

        animation?.stop()

        animation = animate(progress.get(), target, {
            duration: 1.0,
            ease: 'easeInOut',
            onUpdate: (v: number) => progress.set(v),
            onComplete: () => {
                if (target === paths.length - 1) {
                    // Snap back to 0 (same shape — lightning) then animate to 1
                    progress.set(0)
                    pathIndex = 1
                } else {
                    pathIndex = target + 1
                }
            }
        })
    })

    onDestroy(() => {
        animation?.stop()
    })
</script>

<div
    style="display: flex; align-items: center; justify-content: center; width: 100%; min-height: 300px;"
>
    <svg width="400" height="400">
        <g transform="translate(10 10) scale(17 17)">
            <path d={$path} fill={$fill} />
        </g>
    </svg>
</div>
