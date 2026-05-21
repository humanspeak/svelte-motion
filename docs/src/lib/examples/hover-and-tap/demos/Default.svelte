<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    // `whileHover` and `whileTap` declare temporary animation states that
    // motion blends in while a pointer is over (or pressing) the element.
    // Releasing the gesture animates back to the resting `animate` state.
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <motion.button
        type="button"
        aria-label="Hover or tap to scale"
        class="text-text-primary-muted h-[100px] w-[100px] rounded-md border border-border bg-green-500 px-4 py-2"
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.8 }}
    ></motion.button>
    <span class="hint">hover · tap</span>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 2rem;
        min-height: 260px;
    }

    .hint {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
    }
</style>
