<script lang="ts">
    import { AnimatePresence, PresenceChild, motion } from '$lib'

    let realNodePresent = $state(true)
    let realNodeExitCount = $state(0)
    let cloneVisible = $state(true)
    let canvasVisible = $state(true)

    const cardStyle = `
        width: 180px;
        min-height: 96px;
        display: grid;
        place-items: center;
        gap: 8px;
        border-radius: 14px;
        background: #4338ca;
        color: white;
        font-weight: 700;
        padding: 18px;
    `
</script>

<svelte:head>
    <title>AnimatePresence clone fidelity</title>
</svelte:head>

<main>
    <header>
        <p class="eyebrow">Candidate C · status-quo-plus</p>
        <h1>Safer clone exits without changing the public API</h1>
        <p>
            This harness pins real-node exits through <code>PresenceChild</code>, inert exit clones,
            and immediate removal for content that <code>cloneNode(true)</code> cannot reproduce.
        </p>
    </header>

    <section>
        <h2>PresenceChild drives a motion.* exit on the real node</h2>
        <div class="stage">
            <AnimatePresence onExitComplete={() => (realNodeExitCount += 1)}>
                <PresenceChild present={realNodePresent}>
                    <motion.div
                        data-testid="presence-child-motion"
                        style={cardStyle}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.72 }}
                        transition={{ duration: 0.45, ease: 'linear' }}
                    >
                        Real node exit
                    </motion.div>
                </PresenceChild>
            </AnimatePresence>
        </div>
        <div class="controls">
            <button
                data-testid="presence-child-toggle"
                onclick={() => (realNodePresent = !realNodePresent)}
            >
                Toggle real node
            </button>
            <output data-testid="presence-child-exit-count">{realNodeExitCount}</output>
        </div>
    </section>

    <section>
        <h2>Clone exits leave interaction and the accessibility tree</h2>
        <div class="stage">
            <AnimatePresence>
                {#if cloneVisible}
                    <motion.div
                        key="interactive-clone"
                        data-testid="interactive-clone-source"
                        style={cardStyle}
                        exit={{ opacity: 0, y: -24 }}
                        transition={{ duration: 0.8, ease: 'linear' }}
                    >
                        <button>Focusable child</button>
                    </motion.div>
                {/if}
            </AnimatePresence>
        </div>
        <button data-testid="interactive-clone-hide" onclick={() => (cloneVisible = false)}>
            Hide interactive card
        </button>
    </section>

    <section>
        <h2>Stateful media is removed instead of cloned blank</h2>
        <div class="stage">
            <AnimatePresence>
                {#if canvasVisible}
                    <motion.div
                        key="canvas-card"
                        data-testid="canvas-card"
                        style={cardStyle}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <canvas
                            data-testid="stateful-canvas"
                            width="72"
                            height="36"
                            aria-label="Stateful canvas"
                        ></canvas>
                        Canvas content
                    </motion.div>
                {/if}
            </AnimatePresence>
        </div>
        <button data-testid="canvas-card-hide" onclick={() => (canvasVisible = false)}>
            Hide canvas card
        </button>
    </section>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #0f172a;
        color: #e2e8f0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }

    main {
        width: min(960px, calc(100% - 32px));
        margin: 0 auto;
        padding: 48px 0 80px;
    }

    header {
        max-width: 720px;
        margin-bottom: 32px;
    }

    h1,
    h2,
    p {
        margin-top: 0;
    }

    h1 {
        font-size: clamp(2rem, 5vw, 3.4rem);
        line-height: 1;
    }

    h2 {
        font-size: 1rem;
    }

    .eyebrow {
        color: #a5b4fc;
        font-family: ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
    }

    section {
        margin-top: 20px;
        border: 1px solid #334155;
        border-radius: 18px;
        background: #111c31;
        padding: 22px;
    }

    .stage {
        min-height: 150px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #0b1220;
        overflow: hidden;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
    }

    section > button {
        margin-top: 12px;
    }

    button {
        border: 1px solid #818cf8;
        border-radius: 8px;
        background: #312e81;
        color: white;
        padding: 8px 12px;
        cursor: pointer;
    }

    output {
        font-family: ui-monospace, monospace;
    }
</style>
