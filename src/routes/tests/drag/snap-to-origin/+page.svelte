<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="min-height: 320px; display: grid; place-items: center; gap: 16px; padding: 24px;">
    <p style="font: 13px system-ui; color: #666;">Drag each box and release</p>
    <div
        style="display:flex; gap: 28px; align-items:center; justify-content:center; flex-wrap:wrap;"
    >
        <section style="display:grid; place-items:center; gap:8px;">
            <p style="font: 12px system-ui; color:#666; margin:0;">both axes</p>
            <motion.div
                data-testid="snap-origin-box"
                drag
                dragSnapToOrigin
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                style="width: 84px; height: 84px; background:#38bdf8; border-radius: 10px; border:2px solid #0ea5e9;"
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
        <section style="display:grid; place-items:center; gap:8px;">
            <p style="font: 12px system-ui; color:#666; margin:0;">x only</p>
            <motion.div
                data-testid="snap-origin-x-box"
                drag
                dragSnapToOrigin="x"
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                style="width: 84px; height: 84px; background:#a78bfa; border-radius: 10px; border:2px solid #7c3aed;"
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
        <section style="display:grid; place-items:center; gap:8px;">
            <p style="font: 12px system-ui; color:#666; margin:0;">y only</p>
            <motion.div
                data-testid="snap-origin-y-box"
                drag
                dragSnapToOrigin="y"
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                style="width: 84px; height: 84px; background:#fb7185; border-radius: 10px; border:2px solid #e11d48;"
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
    </div>
</div>
