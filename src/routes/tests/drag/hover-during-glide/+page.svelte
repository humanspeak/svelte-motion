<script lang="ts">
    /**
     * Acceptance fixture for the operator's #449 sign-off criterion: hover must
     * respond DURING the post-release momentum glide.
     *
     * Upstream framer-motion releases its global drag lock at pointer-up, so a
     * pointer that enters the element mid-glide starts `whileHover` immediately
     * and the hover scale composes with the in-flight translate. This library
     * suppressed hover until the glide had fully settled, which is stricter than
     * upstream and was visible in review.
     *
     * The card is deliberately unconstrained with a long momentum tail, so the
     * glide lasts long enough to move the pointer off and back on again.
     */
    import { motion } from '$lib'
</script>

<div class="page-shell">
    <header>
        <p class="eyebrow">Issue #449</p>
        <h1>Hover during the momentum glide</h1>
        <p>
            Flick the card to the right and let go, then move the pointer back onto it while it is
            still gliding. Pass: it grows to the hover scale immediately, while the glide keeps
            travelling — no snap, no waiting for the card to stop.
        </p>
    </header>

    <div class="lane">
        <motion.div
            class="glide-card"
            data-testid="glide-card"
            drag="x"
            dragMomentum
            dragTransition={{ power: 1.1, timeConstant: 1100, restDelta: 0.5, restSpeed: 4 }}
            whileHover={{ scale: 1.3 }}
            whileDrag={{ cursor: 'grabbing' }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
            flick me
        </motion.div>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        background: #0b0f14;
        color: #e6edf3;
        font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            sans-serif;
    }

    .page-shell {
        padding: 32px;
        display: grid;
        gap: 28px;
    }

    .eyebrow {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #8bd5ff;
    }

    h1 {
        margin: 6px 0 8px;
        font-size: 26px;
    }

    header p {
        margin: 0;
        max-width: 62ch;
        color: #9fb2c4;
        line-height: 1.5;
    }

    .lane {
        position: relative;
        height: 180px;
        border: 1px dashed #24313d;
        border-radius: 14px;
        display: flex;
        align-items: center;
        padding-left: 24px;
    }

    .glide-card {
        width: 120px;
        height: 90px;
        border-radius: 12px;
        background: linear-gradient(140deg, #2dd4bf, #0ea5e9);
        color: #04141a;
        font-weight: 700;
        display: grid;
        place-items: center;
        cursor: grab;
        touch-action: none;
        user-select: none;
    }
</style>
