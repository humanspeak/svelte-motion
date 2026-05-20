<script lang="ts">
    import { animate, motion } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    // `animate(from, to, options)` drives any imperative value over time.
    // The `onUpdate` callback hands you the latest interpolated value —
    // round it, format it, and stuff it into `$state` to render rich HTML
    // content (here, a giant counter) on each frame.
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

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <motion.pre style="font-size: 64px; color: #8df0cc;">{count}</motion.pre>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 220px;
    }
</style>
