<script lang="ts">
    import { motion } from '$lib'
</script>

<div
    style="height: 420px; display: flex; flex-direction: column; gap: 24px; align-items: center; justify-content: center;"
>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <p style="font: 12px system-ui; color: #666;">Elastic = 0 (no overdrag)</p>
        <div
            style="position: relative; width: 140px; height: 80px; display: grid; place-items: center;"
        >
            <div
                style="position: absolute; width: 140px; height: 80px; border: 2px dashed #fde047; opacity: 0.4; pointer-events: none;"
            ></div>
            <motion.div
                drag="x"
                dragElastic={0}
                dragConstraints={{ left: -30, right: 30 }}
                dragMomentum={false}
                data-testid="elastic-0"
                style="width:80px;height:80px;background:#fde047;border-radius:8px;"
            />
        </div>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <p style="font: 12px system-ui; color: #666;">Elastic = 0.5 (medium overdrag)</p>
        <div
            style="position: relative; width: 140px; height: 80px; display: grid; place-items: center;"
        >
            <div
                style="position: absolute; width: 140px; height: 80px; border: 2px dashed #facc15; opacity: 0.4; pointer-events: none;"
            ></div>
            <motion.div
                drag="x"
                dragElastic={0.5}
                dragConstraints={{ left: -30, right: 30 }}
                dragMomentum={false}
                data-testid="elastic-05"
                style="width:80px;height:80px;background:#facc15;border-radius:8px;"
            />
        </div>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <p style="font: 12px system-ui; color: #666;">Elastic = 1 (full overdrag)</p>
        <div
            style="position: relative; width: 140px; height: 80px; display: grid; place-items: center;"
        >
            <div
                style="position: absolute; width: 140px; height: 80px; border: 2px dashed #eab308; opacity: 0.4; pointer-events: none;"
            ></div>
            <motion.div
                drag="x"
                dragElastic={1}
                dragConstraints={{ left: -30, right: 30 }}
                dragMomentum={false}
                data-testid="elastic-1"
                style="width:80px;height:80px;background:#eab308;border-radius:8px;"
            />
        </div>
    </div>
    <p style="font: 11px system-ui; color: #999;">
        Drag horizontally past the dashed boundary (±30px) to feel elastic resistance
    </p>
</div>
