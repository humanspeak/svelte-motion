<script lang="ts">
    /**
     * Regression for `controls.stop()` / `controls.cancel()` not actually
     * stopping the in-flight inertia animation after a release.
     *
     * Setup: a small draggable card with constraints. Drag past the
     * boundary so elastic engages, release with momentum, then click the
     * Stop button mid-spring. The card should freeze at whatever position
     * it had when stop() was called — not finish its snap-back to the
     * constraint edge.
     */
    import { motion, createDragControls } from '$lib'
    import { onMount } from 'svelte'
    import type { PageData } from './$types'

    let { data }: { data: PageData } = $props()

    let x = $state(0)
    let status = $state('idle')

    const controls = createDragControls()
    const stop = () => {
        controls.stop()
        status = `stopped at ${Math.round(x)}px`
    }
    const dragTransition = $derived(
        data.slow
            ? { bounceStiffness: 14, bounceDamping: 6 }
            : { bounceStiffness: 360, bounceDamping: 24 }
    )
    const dragElastic = $derived(data.slow ? 0.45 : 0.18)

    const readTranslateX = (transform: string): number => {
        if (!transform || transform === 'none') return 0

        const match3d = transform.match(/matrix3d\(([^)]+)\)/)
        if (match3d) {
            const parts = match3d[1].split(',').map(Number)
            return Number.isFinite(parts[12]) ? parts[12] : 0
        }

        const match2d = transform.match(/matrix\(([^)]+)\)/)
        if (match2d) {
            const parts = match2d[1].split(',').map(Number)
            return Number.isFinite(parts[4]) ? parts[4] : 0
        }

        return 0
    }

    onMount(() => {
        let frame = 0
        const update = () => {
            const card = document.querySelector<HTMLElement>('[data-testid="drag-card"]')
            if (card) {
                x = readTranslateX(getComputedStyle(card).transform)
            }
            frame = requestAnimationFrame(update)
        }
        frame = requestAnimationFrame(update)
        return () => cancelAnimationFrame(frame)
    })
</script>

<div class:slow={data.slow} class="stage">
    <div class="readout" aria-live="polite">
        <span data-testid="x-readout">x {Math.round(x)}px</span>
        <span data-testid="status-readout">{status}</span>
    </div>
    <button class="stop-button" type="button" data-testid="stop-btn" onclick={stop}>
        Stop spring
    </button>
    <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        {dragElastic}
        {dragTransition}
        dragControls={controls}
        data-testid="drag-card"
        ondragstart={() => (status = 'dragging')}
        ondragend={() => (status = 'springing back')}
        style="width:100px;height:100px;background:#10b981;border-radius:8px;cursor:grab;"
    />
</div>

<style>
    .stage {
        min-height: 320px;
        display: grid;
        place-items: center;
        gap: 16px;
        padding: 32px;
    }

    .stage.slow {
        min-height: 520px;
        gap: 28px;
    }

    .readout {
        display: flex;
        gap: 16px;
        color: #334155;
        font:
            600 16px/1.2 system-ui,
            sans-serif;
    }

    .stop-button {
        min-width: 320px;
        min-height: 72px;
        border: 3px solid #7f1d1d;
        border-radius: 12px;
        background: #ef4444;
        color: white;
        box-shadow:
            0 10px 0 #991b1b,
            0 18px 28px rgb(127 29 29 / 0.25);
        cursor: pointer;
        font:
            800 20px/1 system-ui,
            sans-serif;
        letter-spacing: 0;
        text-transform: uppercase;
    }

    .stop-button:hover {
        background: #dc2626;
    }

    .stop-button:active {
        transform: translateY(6px);
        box-shadow:
            0 4px 0 #991b1b,
            0 10px 20px rgb(127 29 29 / 0.22);
    }
</style>
