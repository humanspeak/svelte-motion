<script lang="ts">
    /**
     * Regression for element-ref dragConstraints going stale during the
     * inertia animation. The card is constrained to a container that the
     * test can shrink mid-spring via a button. After the resize, the
     * card must end up inside the *new* container bounds — not outside
     * them at the original (now-stale) boundary the stepper captured at
     * pointerdown.
     */
    import { motion } from '$lib'

    const originalWidth = 400
    const resizedWidth = 200

    let { data }: { data: { slow: boolean } } = $props()
    let containerWidth = $state(originalWidth)
    const containerTransition = $derived(
        data.slow ? 'width 3200ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
    )
    const dragTransition = $derived(
        data.slow
            ? {
                  bounceStiffness: 4,
                  bounceDamping: 3,
                  timeConstant: 5200,
                  restDelta: 0.04,
                  restSpeed: 0.3
              }
            : undefined
    )
    const toggleWidth = () => {
        containerWidth = containerWidth === originalWidth ? resizedWidth : originalWidth
    }
    let containerEl: HTMLDivElement | null = $state(null)

    let idleContainer: HTMLDivElement | null = $state(null)
    let idleReset = $state(0)

    const resizeIdle = (width: number) => {
        // Change only DOM geometry so reactive drag options cannot remeasure first.
        if (idleContainer) idleContainer.style.width = `${width}px`
    }

    const resetIdle = () => {
        resizeIdle(originalWidth)
        idleReset += 1
    }
</script>

<div style="padding: 20px;">
    <button type="button" data-testid="resize-btn" onclick={toggleWidth}>
        {containerWidth === originalWidth ? 'Shrink to 200' : 'Grow to 400'}
    </button>
    <div
        bind:this={containerEl}
        data-testid="container"
        style="margin-top:16px;height:200px;width:{containerWidth}px;border:2px dashed #888;position:relative;display:grid;place-items:center;background:#0d1110;transition:{containerTransition};"
    >
        <motion.div
            drag
            dragConstraints={containerEl}
            {dragTransition}
            data-testid="drag-card"
            style="width:80px;height:80px;background:#fb923c;border-radius:8px;cursor:grab;user-select:none;"
        />
    </div>
</div>

<section style="padding:20px;">
    <h2>Resting origin in asymmetric constraints</h2>
    <p>
        The blue card starts 40px from the left edge. Shrink and grow before dragging: it should
        stay at its authored position. After dragging, resize to see the nonzero offset remap. Reset
        restores the original card and container.
    </p>
    <button type="button" data-testid="idle-shrink" onclick={() => resizeIdle(resizedWidth)}
        >Shrink to 200</button
    >
    <button type="button" data-testid="idle-grow" onclick={() => resizeIdle(originalWidth)}
        >Grow to 400</button
    >
    <button type="button" data-testid="idle-reset" onclick={resetIdle}>Reset</button>
    <div
        bind:this={idleContainer}
        data-testid="idle-container"
        style="box-sizing:content-box;margin-top:16px;width:400px;height:160px;border:2px dashed #888;position:relative;background:#0d1110;"
    >
        {#key idleReset}
            <motion.div
                drag="x"
                dragConstraints={idleContainer}
                dragMomentum={false}
                dragElastic={0}
                data-testid="idle-card"
                style="position:absolute;left:40px;top:40px;width:80px;height:80px;background:#38bdf8;border-radius:8px;cursor:grab;user-select:none;"
            />
        {/key}
    </div>
</section>
