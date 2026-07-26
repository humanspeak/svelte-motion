<script lang="ts">
    /**
     * Characterization page for axis OWNERSHIP handoffs — who owns `x`/`y` when a
     * drag session starts, and who owns them when it releases.
     *
     * Three cards, one per handoff:
     *
     * 1. `foreign-x-card` — a long declarative `x` animation is already running
     *    when the pointer grabs it. Upstream stops both axes' animations at
     *    session start (`VisualElementDragControls.ts:114` → `:534-536`), so the
     *    pointer wins outright.
     * 2. `whiledrag-axis-card` — `whileDrag` owns the same channel the drag does
     *    (`y`). On release, the whileDrag-off restore and the momentum glide both
     *    want `y`; upstream deactivates whileDrag BEFORE starting momentum
     *    (`:270-276`, `:305`) so momentum wins and the glide survives.
     * 3. `foreign-retarget-card` — a foreign animation takes the axis mid-glide.
     *    The release must hand over cleanly AND run its cleanup, so nothing of
     *    the dead release survives to interfere: the stale `stopInertia` closure
     *    must not still be armed (cancelling the finished drag afterwards would
     *    otherwise `value.stop()` an axis the gesture no longer owns and kill the
     *    new owner), and the next drag must still start from where the card is.
     *
     * @component
     */
    import { createDragControls, motion } from '$lib'

    const retargetControls = createDragControls()
    let foreignRunning = $state(false)
    let retargetX = $state<number | null>(null)
    let axisTransitionEnds = $state(0)
    let retargetTransitionEnds = $state(0)
</script>

<svelte:head>
    <title>Drag · axis ownership handoff</title>
</svelte:head>

<main>
    <h1>Axis ownership handoff</h1>

    <section>
        <h2>1 · grab during a foreign x animation</h2>
        <p>
            Start the long animation, then grab the card and drag the other way. Pass: it follows
            the pointer immediately — the animation does not fight it.
        </p>
        <button data-testid="start-foreign" onclick={() => (foreignRunning = true)}>
            start long x animation
        </button>
        <div class="lane">
            <motion.div
                class="card card-a"
                data-testid="foreign-x-card"
                drag="x"
                dragMomentum={false}
                animate={foreignRunning ? { x: 520 } : { x: 0 }}
                transition={{ duration: 6, ease: 'linear' }}
            >
                foreign x
            </motion.div>
        </div>
    </section>

    <section>
        <h2>2 · whileDrag owns the dragged axis</h2>
        <p>
            Fling the card downward and let go. Pass: it keeps travelling on <code>y</code> after
            release (momentum owns the axis) and comes to rest at the bottom constraint;
            <code>scale</code> still restores.
        </p>
        <div class="lane lane-tall" data-testid="axis-lane">
            <motion.div
                class="card card-b"
                data-testid="whiledrag-axis-card"
                data-transition-ends={axisTransitionEnds}
                drag
                dragMomentum
                dragConstraints={{ top: -20, bottom: 130, left: -80, right: 80 }}
                dragTransition={{ power: 0.6, timeConstant: 260, restDelta: 0.5, restSpeed: 10 }}
                whileDrag={{ y: -14, scale: 1.06 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                onDragTransitionEnd={() => (axisTransitionEnds += 1)}
            >
                whileDrag y
            </motion.div>
        </div>
    </section>

    <section>
        <h2>3 · foreign retarget mid-glide</h2>
        <p>
            Fling the card right, hit <code>retarget</code> while it is still gliding, then hit
            <code>cancel inertia</code>. Pass: the retarget wins and keeps running (the dead release
            cleaned up after itself, so cancelling it cannot stop someone else's animation), and the
            next drag still starts from where the card actually is.
        </p>
        <button data-testid="retarget" onclick={() => (retargetX = 420)}>retarget x → 420</button>
        <button data-testid="cancel-inertia" onclick={() => retargetControls.cancel()}>
            cancel inertia
        </button>
        <div class="lane">
            <motion.div
                class="card card-c"
                data-testid="foreign-retarget-card"
                data-transition-ends={retargetTransitionEnds}
                drag="x"
                dragMomentum
                dragControls={retargetControls}
                dragTransition={{ power: 0.5, timeConstant: 900, restDelta: 0.5, restSpeed: 4 }}
                animate={retargetX === null ? {} : { x: retargetX }}
                transition={{ duration: 0.9, ease: 'linear' }}
                onDragTransitionEnd={() => (retargetTransitionEnds += 1)}
            >
                foreign retarget
            </motion.div>
        </div>
    </section>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #0a0d12;
        color: #e6edf3;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    main {
        width: min(980px, calc(100% - 32px));
        margin: 0 auto;
        padding: 24px 0 72px;
        display: grid;
        gap: 28px;
    }

    h1 {
        margin: 0;
        font-size: 24px;
    }

    h2 {
        margin: 0 0 6px;
        font-size: 15px;
        color: #8bd5ff;
    }

    p {
        margin: 0 0 10px;
        max-width: 70ch;
        color: #93a4b5;
        line-height: 1.5;
    }

    button {
        margin-bottom: 10px;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid #2c4256;
        background: #12202c;
        color: #cfe6f7;
        font: inherit;
        cursor: pointer;
    }

    .lane {
        position: relative;
        height: 130px;
        border: 1px dashed #24313d;
        border-radius: 12px;
        display: flex;
        align-items: center;
        padding-left: 20px;
    }

    .lane-tall {
        height: 260px;
    }

    .card {
        width: 118px;
        height: 84px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-weight: 700;
        color: #061018;
        cursor: grab;
        touch-action: none;
        user-select: none;
    }

    .card-a {
        background: linear-gradient(140deg, #7dd3fc, #38bdf8);
    }

    .card-b {
        background: linear-gradient(140deg, #fca5a5, #f87171);
    }

    .card-c {
        background: linear-gradient(140deg, #86efac, #34d399);
    }
</style>
