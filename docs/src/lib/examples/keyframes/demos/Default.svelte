<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // Multi-property keyframe animation: scale + rotate + borderRadius.
    // Each property is given its own value sequence; `times` aligns
    // every keyframe to a normalised t in [0, 1].
    // Ported from the motion.dev keyframes example.
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="keyframes-wrapper">
        <motion.div
            class="keyframes-box"
            style={styleString(() => ({ width: 100, height: 100 }))}
            animate={{
                scale: [1, 2, 2, 1, 1],
                rotate: [0, 0, 180, 180, 0],
                borderRadius: ['0%', '0%', '50%', '50%', '0%']
            }}
            transition={{
                duration: 2,
                ease: 'easeInOut',
                times: [0, 0.2, 0.5, 0.8, 1],
                repeat: Infinity,
                repeatDelay: 1
            }}
        />
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 480px;
    }

    .keyframes-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 400px;
        height: 400px;
    }

    .keyframes-wrapper :global(.keyframes-box) {
        background: #ff0088;
    }
</style>
