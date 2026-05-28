<script lang="ts">
    import { LazyMotion, domAnimation, m } from '@humanspeak/svelte-motion'

    let replayId = $state(0)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <LazyMotion features={domAnimation}>
        {#key replayId}
            <m.button
                class="lazy-button"
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ y: -4, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
            >
                Lazy m.button
            </m.button>
        {/key}
    </LazyMotion>

    <button type="button" class="replay" onclick={() => (replayId += 1)}>Replay</button>
</div>

<style>
    .dk-demo-shell {
        min-height: 260px;
        display: grid;
        place-items: center;
        gap: 1rem;
        padding: 2rem;
    }

    :global(.lazy-button) {
        border: 0;
        border-radius: 8px;
        padding: 0.8rem 1.1rem;
        background: #8be9d4;
        color: #071014;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.28);
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
