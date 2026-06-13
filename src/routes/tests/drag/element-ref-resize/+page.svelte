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
    const dragTransition = $derived(
        data.slow
            ? {
                  bounceStiffness: 8,
                  bounceDamping: 4,
                  timeConstant: 3200,
                  restDelta: 0.08,
                  restSpeed: 0.6
              }
            : undefined
    )
    const toggleWidth = () => {
        containerWidth = containerWidth === originalWidth ? resizedWidth : originalWidth
    }
    let containerEl: HTMLDivElement | null = $state(null)
</script>

<div style="padding: 20px;">
    <button type="button" data-testid="resize-btn" onclick={toggleWidth}>
        {containerWidth === originalWidth ? 'Shrink to 200' : 'Grow to 400'}
    </button>
    <div
        bind:this={containerEl}
        data-testid="container"
        style="margin-top:16px;height:200px;width:{containerWidth}px;border:2px dashed #888;position:relative;display:grid;place-items:center;background:#0d1110;"
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
