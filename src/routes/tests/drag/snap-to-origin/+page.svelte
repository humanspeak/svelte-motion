<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="height: 320px; display: grid; place-items: center; gap: 16px;">
    <p style="font: 13px system-ui; color: #666;">
        Drag the box and release: it snaps back to origin
    </p>
    <motion.div
        data-testid="snap-origin-box"
        drag
        dragSnapToOrigin
        dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
        style="width: 84px; height: 84px; background:#38bdf8; border-radius: 10px; border:2px solid #0ea5e9;"
        whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
    />
</div>
