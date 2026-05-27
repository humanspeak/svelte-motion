<script lang="ts">
    import { motion } from '$lib'

    // Regression route for #377 — transform shortcuts must persist as inline
    // style after the WAAPI animation completes (default fill:'none' otherwise
    // surrenders the property, leaving transform:none).
    //
    // All three targets are NON-IDENTITY so "reverted to none" is observably
    // wrong (scaleX(1)/rotate(0) would serialize to `none` either way and
    // couldn't distinguish persisted from reverted):
    //   • scaleX 0 → 0.5  (rests half-scaled)
    //   • rotate 0 → 45   (rests rotated)
    //   • x [0,120,60]    (keyframe array — rests at the LAST element, 60)
    //
    // A slower transition gives e2e room to sample a mid-animation frame and
    // confirm it actually animates (no snap-to-target). `?slow` stretches it
    // to 4s for frame-by-frame debugging of transient glitches.
    // `?slow` stretches the animation to 4s so the enter motion can be
    // watched (and frame-sampled by e2e) instead of completing in 0.6s.
    const slow =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('slow')
    const transition = { duration: slow ? 4 : 0.6, ease: 'linear' } as const
</script>

<svelte:head>
    <title>Motion · animate transform persistence (#377)</title>
</svelte:head>

<div class="page" data-testid="animate-transform-persist">
    <h1>Transform persistence (#377)</h1>
    <p>
        Each box animates a transform shortcut and must <strong>hold the target</strong> at rest —
        not snap back to <code>transform: none</code> when the animation finishes.
    </p>

    <section class="stage">
        <motion.div
            class="box scalex"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 0.5 }}
            {transition}
            data-testid="persist-scalex"
        >
            scaleX → 0.5
        </motion.div>

        <motion.div
            class="box rotate"
            initial={{ rotate: 0 }}
            animate={{ rotate: 45 }}
            {transition}
            data-testid="persist-rotate"
        >
            rotate → 45°
        </motion.div>

        <motion.div
            class="box arr"
            initial={{ x: 0 }}
            animate={{ x: [0, 120, 60] }}
            {transition}
            data-testid="persist-array"
        >
            x → [0,120,60]
        </motion.div>
    </section>
</div>

<style>
    .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 2rem 1rem;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    p {
        color: #475569;
        font-size: 14px;
        line-height: 1.5;
    }
    .stage {
        display: flex;
        flex-direction: column;
        gap: 28px;
        margin-top: 32px;
    }
    :global([data-testid='animate-transform-persist'] .box) {
        width: 160px;
        height: 56px;
        border-radius: 10px;
        color: #fff;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        transform-origin: left center;
    }
    :global([data-testid='animate-transform-persist'] .scalex) {
        background: #6366f1;
    }
    :global([data-testid='animate-transform-persist'] .rotate) {
        background: #ec4899;
    }
    :global([data-testid='animate-transform-persist'] .arr) {
        background: #10b981;
    }
</style>
