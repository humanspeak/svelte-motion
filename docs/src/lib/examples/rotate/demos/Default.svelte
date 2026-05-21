<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    // `animate={{ rotate: 360 }}` tweens the transform's rotate value
    // from its current state to 360°. Bumping the key remounts the
    // element so the rotation plays again.
    let replayId = $state(0)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    {#key replayId}
        <motion.div
            class="size-24 rounded-md bg-pink-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1 }}
        />
    {/key}

    <button type="button" class="replay" onclick={() => (replayId += 1)}> Replay </button>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        padding: 2rem;
        min-height: 260px;
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
