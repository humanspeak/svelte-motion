<script lang="ts">
    import { motion } from '$lib'
    import { ElementRect } from 'runed'
    import { onMount } from 'svelte'

    let box = $state<HTMLElement | null>(null)
    const panelRect = new ElementRect(() => box)

    let interval: ReturnType<typeof setInterval> | null = null
    let stopTimer: ReturnType<typeof setTimeout> | null = null

    function handleDragStart() {
        // Cancel pending stop and ensure logging is running during drag
        if (stopTimer) {
            clearTimeout(stopTimer)
            stopTimer = null
        }
        if (!interval) {
            interval = setInterval(() => {
                console.log('panelRect:start', panelRect.left, panelRect.top)
            }, 50)
        }
    }

    function handleDragEnd() {
        // Start logging every 500ms, then stop 2s after drag end
        if (interval) {
            clearInterval(interval)
            interval = null
        }
        if (stopTimer) {
            clearTimeout(stopTimer)
            stopTimer = null
        }
        interval =
            interval ??
            setInterval(() => {
                console.log('panelRect:end', panelRect.left, panelRect.top)
            }, 50)
        stopTimer = setTimeout(() => {
            if (interval) clearInterval(interval)
            interval = null
            stopTimer = null
        }, 2000)
    }

    onMount(() => {
        return () => {
            if (interval) clearInterval(interval)
            if (stopTimer) clearTimeout(stopTimer)
        }
    })
</script>

<div style="height: 300px; display: grid; place-items: center">
    <motion.div
        bind:ref={box}
        drag
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        data-testid="drag-box"
        style="width:100px;height:100px;background:#4ade80;border-radius:8px;"
    />
</div>
