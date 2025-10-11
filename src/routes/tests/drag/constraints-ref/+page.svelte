<script lang="ts">
    import { motion } from '$lib'
    let bounds: HTMLElement | null = null
</script>

<div style="height: 320px; display: grid; place-items: center">
    <div
        bind:this={bounds}
        style="width:240px;height:180px;border:2px dashed #999;position:relative;display:grid;place-items:center"
    >
        <motion.div
            drag
            dragConstraints={bounds}
            data-testid="drag-ref"
            style="width:80px;height:80px;background:#a78bfa;border-radius:8px;"
        />
    </div>
    <p style="font:12px system-ui;color:#666">Drag is constrained to dashed box</p>
</div>



