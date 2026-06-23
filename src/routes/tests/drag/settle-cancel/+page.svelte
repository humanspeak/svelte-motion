<script lang="ts">
    /**
     * Regression for `snapToOrigin` and no-momentum settle animations not
     * registering a cancel hook. If the user releases the card and then
     * immediately starts a new drag while the snap-to-origin (or
     * no-momentum elastic-clamp) animation is in flight, the prior
     * `animate(...)` controls used to keep running and fight the new
     * drag — the card would drift back toward the old animation's
     * target instead of following the pointer.
     *
     * Cards expose snap, no-momentum settle, and authored-base-transform
     * release paths. Each should honour a re-grab cleanly.
     */
    import { motion } from '$lib'
</script>

<div class="page-shell">
    <header class="intro">
        <p class="eyebrow">Issue #401</p>
        <h1>Drag release cancellation</h1>
        <p>
            Drag a card to the right, release it, then grab it again while it is still settling.
            While you hold the pointer still, the card should stay under the pointer without
            drifting, snapping, or jumping.
        </p>
    </header>

    <section class="case-card">
        <div>
            <p class="case-title">Snap to origin</p>
            <p class="case-copy">
                Try: release, re-grab during the return animation, and hold. Pass: it freezes at the
                re-grab position.
            </p>
        </div>
        <motion.div
            class="drag-card drag-card-blue"
            drag="x"
            dragSnapToOrigin
            transition={{ duration: 0.6 }}
            data-testid="snap-card"
        />
    </section>
    <section class="case-card">
        <div>
            <p class="case-title">No-momentum constraint settle</p>
            <p class="case-copy">
                Try: drag past the right constraint, release, then re-grab mid-settle. Pass: it
                stops fighting the new drag.
            </p>
        </div>
        <motion.div
            class="drag-card drag-card-orange"
            drag="x"
            dragMomentum={false}
            dragConstraints={{ left: -120, right: 120 }}
            dragElastic={0.5}
            transition={{ duration: 0.6 }}
            data-testid="settle-card"
        />
    </section>
    <section class="case-card">
        <div>
            <p class="case-title">Authored base transform</p>
            <p class="case-copy">
                Try: same re-grab gesture. Pass: the tilted, offset card does not jump by its
                authored 40px base transform.
            </p>
        </div>
        <motion.div
            class="drag-card drag-card-teal"
            drag="x"
            dragConstraints={{ left: -160, right: 160 }}
            dragElastic={0.25}
            transition={{ duration: 0.8 }}
            data-testid="base-transform-card"
            style="transform:translateX(40px) rotate(3deg);"
        />
    </section>
</div>

<style>
    :global(body) {
        margin: 0;
        background: #101318;
        color: #edf2f7;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    .page-shell {
        min-height: 100vh;
        display: grid;
        align-content: start;
        gap: 18px;
        padding: 28px;
    }

    .intro {
        max-width: 760px;
        display: grid;
        gap: 8px;
    }

    .eyebrow,
    .case-title,
    .case-copy,
    h1,
    p {
        margin: 0;
    }

    .eyebrow {
        color: #78dcca;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        font-size: 28px;
        line-height: 1.1;
    }

    .intro p:not(.eyebrow),
    .case-copy {
        color: #aeb8c5;
        font-size: 14px;
        line-height: 1.55;
    }

    .case-card {
        width: min(760px, 100%);
        min-height: 148px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 160px;
        align-items: center;
        gap: 24px;
        border: 1px solid #26313d;
        border-radius: 8px;
        background: #161b22;
        padding: 20px;
    }

    .case-title {
        color: #f8fafc;
        font-size: 16px;
        font-weight: 700;
    }

    .case-copy {
        margin-top: 6px;
        max-width: 460px;
    }

    :global(.drag-card) {
        width: 100px;
        height: 100px;
        justify-self: center;
        border-radius: 8px;
        cursor: grab;
        box-shadow: 0 18px 40px rgb(0 0 0 / 0.24);
    }

    :global(.drag-card:active) {
        cursor: grabbing;
    }

    :global(.drag-card-blue) {
        background: linear-gradient(135deg, #46b7f5, #1676d2);
    }

    :global(.drag-card-orange) {
        background: linear-gradient(135deg, #ffb15f, #df5b21);
    }

    :global(.drag-card-teal) {
        background: linear-gradient(135deg, #56dac7, #118476);
    }

    @media (max-width: 640px) {
        .page-shell {
            padding: 18px;
        }

        .case-card {
            grid-template-columns: 1fr;
            justify-items: start;
        }

        :global(.drag-card) {
            justify-self: start;
        }
    }
</style>
