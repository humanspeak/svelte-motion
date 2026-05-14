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

    let containerWidth = $state(400)
    const shrink = () => {
        containerWidth = 200
    }
    let containerEl: HTMLDivElement | null = $state(null)
</script>

<div style="padding: 20px;">
    <button type="button" data-testid="shrink-btn" onclick={shrink}>Shrink to 200</button>
    <div
        bind:this={containerEl}
        data-testid="container"
        style="margin-top:16px;height:200px;width:{containerWidth}px;border:2px dashed #888;position:relative;display:grid;place-items:center;background:#0d1110;"
    >
        <motion.div
            drag
            dragConstraints={containerEl}
            data-testid="drag-card"
            style="width:80px;height:80px;background:#fb923c;border-radius:8px;cursor:grab;user-select:none;"
        />
    </div>
</div>
