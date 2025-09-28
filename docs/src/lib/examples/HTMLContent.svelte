<script lang="ts">
    import { motion, animate } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    let count = $state(0)

    onMount(() => {
        const controls = animate(0, 100, {
            duration: 5,
            onUpdate: (latest: number) => {
                count = Math.round(latest)
            }
        }) as unknown as { stop: () => void }
        return () => controls.stop()
    })
</script>

<motion.pre style="font-size: 64px; color: #8df0cc;">{count}</motion.pre>
