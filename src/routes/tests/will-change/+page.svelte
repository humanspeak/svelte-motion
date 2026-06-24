<script lang="ts">
    import { motion, useWillChange } from '$lib'

    // Auto-managed will-change: starts "auto", flips to "transform" once a
    // transform/accelerated prop animates on the element it's attached to.
    const transformWillChange = useWillChange()
    const colorWillChange = useWillChange()

    let started = $state(false)
    let moved = $state(false)
    let recolored = $state(false)

    // Stay at "auto" (no transform key) until the first interaction, then
    // toggle x back and forth so the box animates both directions. will-change
    // latches to "transform" on the first animation and stays there (upstream
    // useWillChange is one-way).
    const transformTarget = $derived(started ? { x: moved ? 220 : 0 } : {})

    const toggleMove = () => {
        started = true
        moved = !moved
    }
</script>

<svelte:head>
    <title>useWillChange</title>
</svelte:head>

<main>
    <section class="intro">
        <p class="kicker">useWillChange (#327)</p>
        <h1>Promote only while it animates.</h1>
        <p>
            <code>useWillChange()</code> returns a MotionValue you assign to
            <code>style.willChange</code>. It stays <code>auto</code> until a transform or
            accelerated property animates, then flips to <code>transform</code> — so the element only
            gets its own compositor layer while it actually needs one.
        </p>
    </section>

    <section class="grid">
        <article>
            <h2>Transform animation</h2>
            <p class="expectation">
                Animating <code>x</code> flips will-change to <code>transform</code>. It
                <strong>stays</strong> <code>transform</code> after the first animation — useWillChange
                is a one-way latch (matches upstream).
            </p>
            <p class="readout" data-testid="transform-value">
                value: {transformWillChange.current}
            </p>
            <div class="track">
                <motion.div
                    class="orb cyan"
                    data-testid="transform-box"
                    style={{ willChange: transformWillChange }}
                    initial={false}
                    animate={transformTarget}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                    T
                </motion.div>
            </div>
            <button type="button" data-testid="move" onclick={toggleMove}>
                {moved ? 'Return' : 'Animate x'}
            </button>
        </article>

        <article>
            <h2>Non-transform animation</h2>
            <p class="expectation">
                Animating only <code>backgroundColor</code> leaves will-change at
                <code>auto</code>.
            </p>
            <p class="readout" data-testid="color-value">value: {colorWillChange.current}</p>
            <div class="track">
                <motion.div
                    class="orb"
                    data-testid="color-box"
                    style={{ willChange: colorWillChange }}
                    initial={false}
                    animate={{ backgroundColor: recolored ? '#f0abfc' : '#67e8f9' }}
                    transition={{ duration: 0.5 }}
                >
                    C
                </motion.div>
            </div>
            <button type="button" data-testid="recolor" onclick={() => (recolored = !recolored)}>
                {recolored ? 'Reset' : 'Animate color'}
            </button>
        </article>
    </section>
</main>

<style>
    :global(html),
    :global(body) {
        background: #071012;
        color: #ecfdf5;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    main {
        min-height: 100vh;
        width: min(1000px, calc(100vw - 32px));
        display: grid;
        align-content: center;
        gap: 28px;
        margin: 0 auto;
        padding: 48px 0;
    }

    .intro {
        max-width: 720px;
    }

    .kicker {
        margin: 0 0 8px;
        color: #67e8f9;
        font-size: 13px;
        font-weight: 850;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: clamp(34px, 5vw, 56px);
        line-height: 0.95;
    }

    .intro p:not(.kicker) {
        margin: 14px 0 0;
        color: #b7d4d8;
        font-size: 16px;
        line-height: 1.65;
    }

    code {
        color: #f0abfc;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
    }

    article {
        display: grid;
        align-content: start;
        gap: 14px;
        padding: 24px;
        border: 1px solid rgba(125, 211, 252, 0.3);
        background: #0b171a;
        overflow: hidden;
    }

    h2 {
        margin: 0;
        color: #dff8ff;
        font-size: 18px;
    }

    .expectation {
        margin: 0;
        color: #a9c9cf;
        font-size: 13px;
        line-height: 1.45;
    }

    .readout {
        margin: 0;
        color: #67e8f9;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 15px;
        font-weight: 800;
    }

    .track {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        padding: 12px;
        border: 1px dashed rgba(125, 211, 252, 0.24);
        min-height: 120px;
    }

    :global(.orb) {
        width: 88px;
        height: 88px;
        display: grid;
        place-items: center;
        border-radius: 22px;
        background: #67e8f9;
        color: #031316;
        font-size: 22px;
        font-weight: 900;
    }

    :global(.orb.cyan) {
        background: linear-gradient(135deg, #67e8f9, #2dd4bf);
    }

    button {
        justify-self: start;
        min-width: 120px;
        border: 1px solid rgba(125, 211, 252, 0.45);
        border-radius: 6px;
        background: #102332;
        color: #ecfeff;
        padding: 10px 14px;
        font: inherit;
        font-weight: 850;
        cursor: pointer;
    }

    button:hover {
        border-color: #67e8f9;
        background: #153247;
    }

    @media (max-width: 760px) {
        .grid {
            grid-template-columns: 1fr;
        }
    }
</style>
