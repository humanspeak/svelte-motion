<script lang="ts">
    import {
        animate,
        createDragControls,
        motion,
        useAnimate,
        useMotionValue,
        type RawMotionValue
    } from '@humanspeak/svelte-motion'

    let open = $state(false)

    // `useAnimate` scopes imperative animations to the overlay it attaches to,
    // so the backdrop can fade on close.
    const [scope, scopedAnimate] = useAnimate()

    // The sheet element, measured at close time so it slides fully off-screen.
    let sheetRef = $state<HTMLElement | null>(null)

    // The bound drag offset. `drag` writes this MotionValue (so `y.get()` reads
    // the live position) and the close animation drives it back — animating the
    // same value the gesture left off (#421).
    const y = useMotionValue(0)
    const controls = createDragControls()

    const handleClose = async () => {
        // Fade the backdrop out…
        if (scope.current) scopedAnimate(scope.current, { opacity: [1, 0] })

        // …and slide the sheet down by its own height, continuing from wherever
        // the drag left it.
        const height = sheetRef?.offsetHeight ?? 0
        await animate(y as unknown as RawMotionValue<number>, height, {
            duration: 0.3,
            ease: 'easeInOut'
        })

        open = false
        // Reset for the next open (the MotionValue outlives the {#if} block).
        y.set(0)
    }

    // Keyboard escape hatch: the handle/backdrop are pointer-driven, so without
    // this the sheet would be a keyboard trap (openable but not closable).
    $effect(() => {
        if (!open) return
        const onKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose()
        }
        window.addEventListener('keydown', onKeydown)
        return () => window.removeEventListener('keydown', onKeydown)
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <section class="drawer-demo" aria-label="Drag to close drawer example">
        <div class="phone">
            <div class="screen">
                <p class="screen-hint">Tap to open the bottom sheet</p>
                <button class="open-btn" onclick={() => (open = true)}>Open drawer</button>
            </div>

            {#if open}
                <motion.div
                    {@attach scope}
                    scoped:class="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onclick={handleClose}
                >
                    <motion.div
                        bind:ref={sheetRef}
                        scoped:class="sheet"
                        style={{ y }}
                        initial={{ y: '100%' }}
                        animate={{ y: '0%' }}
                        transition={{ ease: 'easeInOut' }}
                        drag="y"
                        dragControls={controls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        onclick={(e: MouseEvent) => e.stopPropagation()}
                        onDragEnd={() => {
                            if (y.get() >= 100) handleClose()
                        }}
                    >
                        <div class="handle-row">
                            <button
                                class="handle"
                                aria-label="Drag to close"
                                onpointerdown={(e: PointerEvent) => controls.start(e)}
                            ></button>
                        </div>
                        <div class="sheet-body">
                            <h3>Drag me down to close</h3>
                            <p>
                                Grab the handle and pull this sheet down past the threshold to
                                dismiss it, or tap the backdrop. The drag writes the bound
                                <code>y</code> MotionValue, and the close animation continues from wherever
                                you let go.
                            </p>
                            <p>
                                Release before the threshold and it springs back into place with a
                                little elastic give.
                            </p>
                            <div class="rows">
                                <span></span><span></span><span></span><span></span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            {/if}
        </div>
    </section>
</div>

<style>
    .dk-demo-shell {
        min-height: 560px;
        display: grid;
        place-items: center;
        padding: clamp(1rem, 4vw, 2.5rem);
    }

    /* Theme tokens — dark is the default (the docs site toggles `.dark` on
       <html>); the light overrides live in the `html:not(.dark)` block below. */
    .drawer-demo {
        --phone-bg: radial-gradient(circle at 30% 18%, #1e293b, #020617 68%);
        --phone-border: rgb(148 163 184 / 0.22);
        --phone-shadow: 0 30px 90px rgb(0 0 0 / 0.45);
        --screen-text: rgb(226 232 240 / 0.66);
        --btn-bg: linear-gradient(
            135deg,
            var(--color-brand-400, #34d399),
            var(--color-brand-600, #059669)
        );
        --btn-text: #022c22;
        --btn-shadow: 0 10px 24px
            color-mix(in oklab, var(--color-brand-500, #10b981) 38%, transparent);
        --scrim: rgb(2 6 23 / 0.55);
        --sheet-bg: #0f172a;
        --sheet-border: rgb(148 163 184 / 0.16);
        --sheet-title: #f1f5f9;
        --sheet-text: rgb(203 213 225 / 0.78);
        --handle: rgb(148 163 184 / 0.5);
        --row: rgb(148 163 184 / 0.14);
        --code-bg: rgb(148 163 184 / 0.16);
        --code-text: #e2e8f0;

        display: grid;
        place-items: center;
        width: 100%;
    }

    :global(html:not(.dark)) .drawer-demo {
        --phone-bg: radial-gradient(circle at 30% 18%, #ffffff, #eef2ff 70%);
        --phone-border: rgb(15 23 42 / 0.12);
        --phone-shadow: 0 24px 70px rgb(15 23 42 / 0.16);
        --screen-text: rgb(15 23 42 / 0.56);
        --btn-bg: linear-gradient(
            135deg,
            var(--color-brand-400, #34d399),
            var(--color-brand-600, #059669)
        );
        --btn-text: #022c22;
        --btn-shadow: 0 10px 24px
            color-mix(in oklab, var(--color-brand-600, #059669) 28%, transparent);
        --scrim: rgb(15 23 42 / 0.4);
        --sheet-bg: #ffffff;
        --sheet-border: rgb(15 23 42 / 0.1);
        --sheet-title: #0f172a;
        --sheet-text: rgb(51 65 85 / 0.82);
        --handle: rgb(15 23 42 / 0.28);
        --row: rgb(15 23 42 / 0.08);
        --code-bg: rgb(15 23 42 / 0.08);
        --code-text: #1e293b;
    }

    .phone {
        position: relative;
        width: min(360px, 92vw);
        height: 600px;
        max-height: 70vh;
        overflow: hidden;
        border-radius: 28px;
        border: 1px solid var(--phone-border);
        background: var(--phone-bg);
        box-shadow: var(--phone-shadow);
    }

    .screen {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 1rem;
        text-align: center;
        padding: 1.5rem;
    }

    .screen-hint {
        margin: 0;
        font-size: 0.85rem;
        color: var(--screen-text);
    }

    .open-btn {
        appearance: none;
        border: none;
        cursor: pointer;
        border-radius: 9px;
        padding: 0.6rem 1.1rem;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--btn-text);
        background: var(--btn-bg);
        box-shadow: var(--btn-shadow);
        transition: transform 0.15s ease;
    }

    .open-btn:hover {
        transform: translateY(-1px);
    }

    .open-btn:active {
        transform: translateY(0);
    }

    /* The overlay + sheet are `motion` components. `scoped:class` (a Svelte
       Motion feature) keeps this component's scope on their rendered elements,
       so these plain scoped selectors apply without needing `:global()`. */
    .overlay {
        position: absolute;
        inset: 0;
        z-index: 10;
        background: var(--scrim);
        backdrop-filter: blur(2px);
    }

    .sheet {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 78%;
        overflow: hidden;
        border-top-left-radius: 22px;
        border-top-right-radius: 22px;
        border: 1px solid var(--sheet-border);
        border-bottom: none;
        background: var(--sheet-bg);
        box-shadow: 0 -18px 50px rgb(0 0 0 / 0.28);
    }

    .handle-row {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1;
        display: flex;
        justify-content: center;
        padding: 0.85rem;
        background: var(--sheet-bg);
    }

    .handle {
        appearance: none;
        height: 6px;
        width: 56px;
        padding: 0;
        border: none;
        border-radius: 999px;
        background: var(--handle);
        cursor: grab;
        touch-action: none;
    }

    .handle:active {
        cursor: grabbing;
    }

    .sheet-body {
        height: 100%;
        overflow-y: auto;
        padding: 3.25rem 1.4rem 1.4rem;
        color: var(--sheet-text);
    }

    .sheet-body h3 {
        margin: 0 0 0.6rem;
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--sheet-title);
    }

    .sheet-body p {
        margin: 0 0 0.85rem;
        font-size: 0.92rem;
        line-height: 1.5;
    }

    .sheet-body code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.85em;
        padding: 0.08em 0.34em;
        border-radius: 4px;
        background: var(--code-bg);
        color: var(--code-text);
    }

    .rows {
        display: grid;
        gap: 0.75rem;
        margin-top: 1.25rem;
    }

    .rows span {
        height: 2.5rem;
        border-radius: 8px;
        background: var(--row);
    }
</style>
