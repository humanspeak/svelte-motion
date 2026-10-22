<script lang="ts">
    /**
     * Window scroll during a held pan.
     *
     * The page is taller than the viewport. Press the card, move a little,
     * hold still, then scroll the window (wheel or keyboard) and nudge the
     * pointer. Motion's `PanSession` reports page coordinates, so
     * `info.point.y` must grow by the scrolled distance.
     *
     * The second card sets both `drag` and `onPan`: upstream enables the pan
     * feature regardless of `drag` (framer-motion
     * `motion/features/definitions.ts:21` @ v14.5.0), so it moves AND reports
     * pan.
     *
     * @component
     */
    import { motion, type DragInfo } from '$lib'

    let pointY = $state<number | null>(null)
    let panCount = $state(0)
    let dragPanCount = $state(0)

    const handlePan = (_event: PointerEvent, info: DragInfo) => {
        pointY = info.point.y
        panCount += 1
    }
</script>

<svelte:head>
    <title>Motion · pan during window scroll</title>
</svelte:head>

<main>
    <h1>Pan during window scroll</h1>
    <p>
        Press the card, move a few pixels and hold still. Scroll the window, then nudge the pointer.
        <code>info.point.y</code> follows the page, so it grows by the scrolled distance.
    </p>
    <p>
        point.y: <strong data-testid="pan-window-scroll-readout">{pointY ?? '—'}</strong>
        · onPan calls: <strong>{panCount}</strong>
    </p>

    <motion.div
        class="card"
        data-testid="pan-window-scroll-card"
        data-point-y={pointY ?? ''}
        data-pan-count={panCount}
        onPan={handlePan}
    >
        pan me
    </motion.div>

    <h2>drag + onPan</h2>
    <p>
        This card sets <code>drag</code> and <code>onPan</code>. Dragging it moves it and also fires
        <code>onPan</code> (onPan calls: <strong>{dragPanCount}</strong>).
    </p>

    <motion.div
        class="card"
        data-testid="pan-drag-coattach-card"
        data-pan-count={dragPanCount}
        drag
        dragMomentum={false}
        onPan={() => (dragPanCount += 1)}
    >
        drag + onPan
    </motion.div>

    <div class="spacer" aria-hidden="true"></div>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #07100f;
        color: #e8fffa;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    main {
        width: min(920px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 64px;
    }

    :global(.card) {
        width: 160px;
        height: 88px;
        display: grid;
        place-items: center;
        border: 1px solid #76ead3;
        border-radius: 12px;
        color: #06110f;
        background: #54dbbc;
        user-select: none;
        touch-action: none;
    }

    .spacer {
        height: 3000px;
    }
</style>
