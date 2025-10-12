<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="min-height: 420px; display: grid; place-items: center; gap: 24px;">
    <div
        style="position: relative; width: 220px; height: 120px; display: grid; place-items: center;"
    >
        <div
            data-testid="subpixel-guide"
            style="position: absolute; width: 220px; height: 120px; border: 2px dashed #9ca3af; opacity: 0.4; pointer-events: none;"
        ></div>
        <motion.div
            data-testid="subpixel-box-e35"
            drag="x"
            dragConstraints={{ left: -30.5, right: 30.5 }}
            dragElastic={0.35}
            style="width:72px;height:72px;background:#93c5fd;border-radius:10px; border:2px solid #64748b;"
        />
    </div>
    <p style="font: 12px system-ui; color: #666; margin-top: -12px;">
        Elastic 0.35 — Constraints: ±30.5 (floats)
    </p>

    <div
        style="position: relative; width: 220px; height: 120px; display: grid; place-items: center;"
    >
        <div
            data-testid="subpixel-guide2"
            style="position: absolute; width: 220px; height: 120px; border: 2px dashed #9ca3af; opacity: 0.4; pointer-events: none;"
        ></div>
        <motion.div
            data-testid="subpixel-box-e0"
            drag="x"
            dragConstraints={{ left: -30.5, right: 30.5 }}
            dragElastic={0}
            dragMomentum={false}
            style="width:72px;height:72px;background:#60a5fa;border-radius:10px; border:2px solid #64748b;"
        />
    </div>
    <p style="font: 12px system-ui; color: #666; margin-top: -12px;">
        Elastic 0 — Constraints: ±30.5 (floats)
    </p>
</div>
