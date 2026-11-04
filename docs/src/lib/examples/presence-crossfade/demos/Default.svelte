<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'

    // A gallery whose card opens out of its thumbnail and closes back into
    // it. The card is the owned `AnimatePresence` child (`present` +
    // `child`): when it closes it stays mounted, relegated, while the
    // thumbnail takes its layoutId back and grows out of it; the card fades
    // out and is removed when that animation ends, as in Motion.
    //
    // A snippet reads live state, so the card reads `shown`, the colour it
    // was opened with, rather than `open`, which is `null` while it closes.
    const colors = ['#247768', '#d9733f', '#5b5bd6']

    let open = $state<string | null>(null)
    let shown = $state<string | null>(null)
    $effect.pre(() => {
        if (open) shown = open
    })

    const transition = { type: 'spring' as const, stiffness: 300, damping: 30 }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="stage">
        <div class="gallery">
            {#each colors as color (color)}
                <motion.button
                    type="button"
                    class="thumb"
                    layoutId={color}
                    {transition}
                    style="background: {color};"
                    aria-label="Open card"
                    onclick={() => (open = color)}
                />
            {/each}
        </div>
        <AnimatePresence present={open !== null}>
            {#snippet child()}
                <motion.button
                    type="button"
                    class="card"
                    layoutId={shown ?? undefined}
                    {transition}
                    style="background: {shown};"
                    aria-label="Close card"
                    onclick={() => (open = null)}
                />
            {/snippet}
        </AnimatePresence>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 380px;
    }

    .stage {
        position: relative;
        width: 320px;
        height: 300px;
    }

    .gallery {
        display: flex;
        gap: 16px;
    }

    .stage :global(.thumb) {
        width: 88px;
        height: 64px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
    }

    .stage :global(.card) {
        position: absolute;
        left: 0;
        top: 96px;
        width: 320px;
        height: 200px;
        border: none;
        border-radius: 16px;
        cursor: pointer;
        z-index: 1;
    }
</style>
