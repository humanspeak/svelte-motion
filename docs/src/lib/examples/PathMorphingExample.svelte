<script lang="ts">
    import { animate, useMotionValue, useTransform } from '@humanspeak/svelte-motion'
    import { interpolate } from 'flubber'
    import { onDestroy, onMount } from 'svelte'

    const star = 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z'
    const heart =
        'M 50 90 C 25 70 0 50 0 30 C 0 12 15 0 30 0 C 40 0 48 5 50 15 C 52 5 60 0 70 0 C 85 0 100 12 100 30 C 100 50 75 70 50 90 Z'
    const hand =
        'M 40 95 L 20 95 L 20 55 L 5 55 L 5 35 L 20 35 L 20 5 L 35 5 L 35 35 L 45 35 L 45 15 L 60 15 L 60 35 L 70 35 L 70 20 L 85 20 L 85 40 L 90 40 L 90 55 L 95 55 L 95 75 L 80 95 Z'
    const plane =
        'M 50 5 L 95 50 L 65 50 L 65 65 L 80 95 L 55 75 L 50 95 L 45 75 L 20 95 L 35 65 L 35 50 L 5 50 Z'
    const lightning = 'M 55 0 L 30 50 L 50 50 L 25 100 L 75 40 L 55 40 L 80 0 Z'
    const note =
        'M 35 5 L 65 5 L 65 70 C 65 85 55 95 40 95 C 25 95 15 85 15 70 C 15 55 25 45 40 45 C 45 45 50 47 55 50 L 55 5 Z'

    const paths = [star, heart, hand, plane, lightning, note]
    const colors = ['#00cc88', '#ff0055', '#ee7752', '#0099ff', '#ffcc00', '#7c3aed']

    const progress = useMotionValue(0)

    const indices = paths.map((_, i) => i)
    const fill = useTransform(progress, indices, colors)
    const path = useTransform(progress, indices, paths, {
        mixer: (a, b) => interpolate(a as string, b as string, { maxSegmentLength: 0.1 })
    })

    let animation: ReturnType<typeof animate> | undefined
    let mounted = false

    function startAnimation(from: number) {
        const to = from + 1 >= paths.length ? 0 : from + 1
        animation = animate(from, to, {
            duration: 0.8,
            ease: 'easeInOut',
            onUpdate: (v: number) => progress.set(v),
            onComplete: () => {
                if (mounted) startAnimation(to)
            }
        })
    }

    onMount(() => {
        mounted = true
        startAnimation(0)
    })

    onDestroy(() => {
        mounted = false
        animation?.stop()
    })
</script>

<div
    style="display: flex; align-items: center; justify-content: center; width: 100%; min-height: 300px;"
>
    <svg width="200" height="200" viewBox="0 0 100 100">
        <path d={$path} fill={$fill} />
    </svg>
</div>
