<script lang="ts">
    import { motion, animate } from '$lib/index.js'
    import { onMount } from 'svelte'
    import { writable } from 'svelte/store'

    const count = writable(0)

    onMount(() => {
        const controls = animate(0, 100, {
            duration: 5,
            onUpdate: (latest: number) => {
                count.set(Math.round(latest))
            }
        }) as unknown as { stop: () => void }
        return () => controls.stop()
    })
</script>

<motion.pre style="font-size: 64px; color: #8df0cc;">{$count}</motion.pre>
