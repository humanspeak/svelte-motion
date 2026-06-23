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
    import type { PageData } from './$types'

    let { data }: { data: PageData } = $props()

    const slowSnapTransition = $derived(
        data.slow
            ? {
                  bounceStiffness: 6,
                  bounceDamping: 2.4,
                  restDelta: 0.01,
                  restSpeed: 0.01
              }
            : undefined
    )
    const slowSettleTransition = $derived(
        data.slow
            ? {
                  bounceStiffness: 7,
                  bounceDamping: 2.6,
                  restDelta: 0.01,
                  restSpeed: 0.01
              }
            : undefined
    )
    const slowBaseTransition = $derived(
        data.slow
            ? {
                  bounceStiffness: 6,
                  bounceDamping: 2.4,
                  restDelta: 0.01,
                  restSpeed: 0.01
              }
            : undefined
    )
</script>

<div class:slow={data.slow} class="page-shell">
    <header class="intro">
        <p class="eyebrow">Issue #401</p>
        <h1>Drag release cancellation</h1>
        <p>
            Drag a card to the right, release it, then grab it again while it is still settling.
            While you hold the pointer still, the card should stay under the pointer without
            drifting, snapping, or jumping.
        </p>
        {#if data.slow}
            <p class="slow-note">Very slow review mode is on.</p>
        {/if}
    </header>

    <section class="case-card">
        <div>
            <p class="case-index">1. returns home</p>
            <p class="case-title">Snap to origin</p>
            <p class="case-copy">
                Drag right and release: it heads all the way back to the home line. Re-grab
                mid-return and hold still. Pass: it freezes under your pointer.
            </p>
        </div>
        <div class="demo-lane">
            <span class="lane-marker lane-marker-home">home</span>
            <motion.div
                class="drag-card drag-card-blue"
                drag="x"
                dragSnapToOrigin
                dragMomentum={!data.slow}
                dragTransition={slowSnapTransition}
                data-testid="snap-card"
            />
        </div>
    </section>
    <section class="case-card">
        <div>
            <p class="case-index">2. settles to boundary</p>
            <p class="case-title">No-momentum constraint settle</p>
            <p class="case-copy">
                Drag far past the right edge and release: it springs back only to the constraint
                line, not all the way home. Re-grab mid-settle. Pass: it stops fighting the new
                drag.
            </p>
        </div>
        <div class="demo-lane">
            <span class="lane-marker lane-marker-home">home</span>
            <span class="lane-marker lane-marker-boundary">right limit</span>
            <motion.div
                class="drag-card drag-card-orange"
                drag="x"
                dragMomentum={false}
                dragConstraints={{ left: -120, right: 120 }}
                dragElastic={0.5}
                dragTransition={slowSettleTransition}
                data-testid="settle-card"
            />
        </div>
    </section>
    <section class="case-card">
        <div>
            <p class="case-index">3. keeps authored transform</p>
            <p class="case-title">Authored base transform</p>
            <p class="case-copy">
                Try: same re-grab gesture. Pass: the tilted, offset card does not jump by its
                authored 40px base transform.
            </p>
        </div>
        <div class="demo-lane demo-lane-authored">
            <span class="lane-marker lane-marker-authored-left">left limit</span>
            <span class="lane-marker lane-marker-authored-origin">authored +40px</span>
            <span class="lane-marker lane-marker-authored-right">right limit</span>
            <motion.div
                class="drag-card drag-card-teal"
                drag="x"
                dragMomentum={!data.slow}
                dragConstraints={{ left: -160, right: 160 }}
                dragElastic={0.25}
                dragTransition={slowBaseTransition}
                data-testid="base-transform-card"
                style="transform:translateX(40px) rotate(3deg);"
            />
        </div>
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
    .case-copy,
    .slow-note {
        color: #aeb8c5;
        font-size: 14px;
        line-height: 1.55;
    }

    .slow-note {
        width: fit-content;
        border: 1px solid rgb(120 220 202 / 0.38);
        border-radius: 999px;
        background: rgb(120 220 202 / 0.08);
        padding: 6px 10px;
        color: #c7fff5;
        font-weight: 700;
    }

    .case-card {
        width: min(960px, 100%);
        min-height: 170px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
        align-items: center;
        gap: 28px;
        border: 1px solid #26313d;
        border-radius: 8px;
        background: #161b22;
        padding: 20px;
    }

    .case-index {
        color: #78dcca;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .case-title {
        margin-top: 3px;
        color: #f8fafc;
        font-size: 16px;
        font-weight: 700;
    }

    .case-copy {
        margin-top: 6px;
        max-width: 460px;
    }

    .demo-lane {
        position: relative;
        width: min(100%, 420px);
        height: 122px;
        display: grid;
        place-items: center;
        justify-self: stretch;
        border-radius: 8px;
        background:
            linear-gradient(90deg, transparent 0 8px, rgb(255 255 255 / 0.04) 8px 9px) 0 0 / 28px
                100%,
            #11161d;
        overflow: visible;
    }

    .demo-lane::before,
    .lane-marker {
        position: absolute;
        top: 12px;
        bottom: 12px;
        width: 1px;
        background: rgb(120 220 202 / 0.5);
    }

    .demo-lane::before {
        content: '';
        left: 50%;
    }

    .lane-marker {
        display: grid;
        align-content: end;
        padding-bottom: 4px;
        color: #9fb2c5;
        font-size: 11px;
        pointer-events: none;
        white-space: nowrap;
        text-indent: 7px;
    }

    .lane-marker-home {
        left: 50%;
    }

    .lane-marker-boundary {
        left: calc(50% + 120px);
        background: rgb(255 177 95 / 0.65);
    }

    .lane-marker-authored-left {
        left: calc(50% + 40px - 160px);
        background: rgb(255 177 95 / 0.65);
    }

    .lane-marker-authored-origin {
        left: calc(50% + 40px);
        top: -18px;
        align-content: start;
        padding-top: 0;
        padding-bottom: 0;
        text-indent: -42px;
        z-index: 2;
    }

    .lane-marker-authored-right {
        left: calc(50% + 40px + 160px);
        background: rgb(255 177 95 / 0.65);
        text-indent: -52px;
    }

    :global(.drag-card) {
        position: relative;
        z-index: 1;
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

        .demo-lane {
            width: 100%;
        }

        :global(.drag-card) {
            justify-self: start;
        }
    }
</style>
