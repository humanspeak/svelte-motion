<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    // Simplest motion lesson: an element mounts with `initial` styles
    // and tweens to `animate` styles. The transition controls the timing.
    // Click Replay to remount the button so the entrance plays again.
    let replayId = $state(0)
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    {#key replayId}
        <motion.button
            class="my-4 rounded-md border border-border bg-blue-300 px-4 py-2 text-text-primary"
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
        >
            Animated button
        </motion.button>
    {/key}

    <button type="button" class="replay" onclick={() => (replayId += 1)}> Replay </button>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 2rem;
        min-height: 220px;
    }

    .replay {
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
    }
</style>
