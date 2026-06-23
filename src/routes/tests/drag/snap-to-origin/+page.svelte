<script lang="ts">
    import { motion } from '$lib'
</script>

<div class="page-shell">
    <header class="intro">
        <p class="eyebrow">Issue #401</p>
        <h1>Axis-specific snap to origin</h1>
        <p>
            Drag each box diagonally and release. The named snap axis should return to origin; the
            other active axis should stay within the visible constraint range.
        </p>
    </header>

    <div class="grid">
        <section class="case-card">
            <p class="case-title">Both axes</p>
            <p class="case-copy">Pass: x and y both animate back to the start point.</p>
            <motion.div
                class="drag-card drag-card-sky"
                data-testid="snap-origin-box"
                drag
                dragSnapToOrigin
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
        <section class="case-card">
            <p class="case-title">X only</p>
            <p class="case-copy">Pass: x returns to origin; y settles inside the +/-30px bounds.</p>
            <motion.div
                class="drag-card drag-card-violet"
                data-testid="snap-origin-x-box"
                drag
                dragSnapToOrigin="x"
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
        <section class="case-card">
            <p class="case-title">Y only</p>
            <p class="case-copy">Pass: y returns to origin; x settles inside the +/-60px bounds.</p>
            <motion.div
                class="drag-card drag-card-rose"
                data-testid="snap-origin-y-box"
                drag
                dragSnapToOrigin="y"
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
        <section class="case-card">
            <p class="case-title">X only, no momentum</p>
            <p class="case-copy">Pass: x returns to origin; y springs to the +/-30px boundary.</p>
            <motion.div
                class="drag-card drag-card-teal"
                data-testid="snap-origin-x-no-momentum-box"
                drag
                dragMomentum={false}
                dragSnapToOrigin="x"
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                dragElastic={0.5}
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
        <section class="case-card">
            <p class="case-title">Y only, no momentum</p>
            <p class="case-copy">Pass: y returns to origin; x springs to the +/-60px boundary.</p>
            <motion.div
                class="drag-card drag-card-yellow"
                data-testid="snap-origin-y-no-momentum-box"
                drag
                dragMomentum={false}
                dragSnapToOrigin="y"
                dragConstraints={{ left: -60, right: 60, top: -30, bottom: 30 }}
                dragElastic={0.5}
                whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            />
        </section>
    </div>
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
        gap: 22px;
        padding: 28px;
    }

    .intro {
        max-width: 800px;
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
        line-height: 1.5;
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;
        gap: 18px;
    }

    .case-card {
        width: 210px;
        min-height: 218px;
        display: grid;
        align-content: start;
        justify-items: center;
        gap: 9px;
        border: 1px solid #26313d;
        border-radius: 8px;
        background: #161b22;
        padding: 16px;
        text-align: center;
    }

    .case-title {
        color: #f8fafc;
        font-size: 15px;
        font-weight: 700;
    }

    .case-copy {
        min-height: 42px;
        font-size: 12px;
    }

    :global(.drag-card) {
        width: 84px;
        height: 84px;
        margin-top: 8px;
        border-radius: 8px;
        cursor: grab;
        box-shadow: 0 16px 32px rgb(0 0 0 / 0.22);
    }

    :global(.drag-card:active) {
        cursor: grabbing;
    }

    :global(.drag-card-sky) {
        background: linear-gradient(135deg, #55cdf6, #168fd4);
    }

    :global(.drag-card-violet) {
        background: linear-gradient(135deg, #b99cff, #7453dc);
    }

    :global(.drag-card-rose) {
        background: linear-gradient(135deg, #ff8ca0, #dd3156);
    }

    :global(.drag-card-teal) {
        background: linear-gradient(135deg, #56dac7, #118476);
    }

    :global(.drag-card-yellow) {
        background: linear-gradient(135deg, #ffe078, #c89116);
    }
</style>
