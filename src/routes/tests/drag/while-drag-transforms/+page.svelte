<script lang="ts">
    /**
     * Characterization page for transform channels that the drag composer
     * currently overwrites or fails to paint while the pointer is held.
     */
    import { motion } from '$lib'

    let inserted = $state(false)
    let stackBounds: HTMLElement | null = $state(null)
</script>

<svelte:head>
    <title>Drag · whileDrag transform composition</title>
</svelte:head>

<main>
    <h1>whileDrag transform composition</h1>
    <p>
        Hold each card while dragging. Rotation, 3D transforms, and cross-axis layout pinning should
        remain composed with the live drag translation.
    </p>

    <section>
        <h2>2D rotation</h2>
        <div class="stage">
            <motion.div
                class="card rotate-card"
                data-testid="rotate-card"
                drag="x"
                dragMomentum={false}
                whileDrag={{ rotate: 8 }}
                transition={{ duration: 0.05 }}
            >
                rotate 8°
            </motion.div>
        </div>
    </section>

    <section>
        <h2>Cross-axis layout pinning</h2>
        <button
            type="button"
            data-testid="insert-above"
            onclick={() => (inserted = true)}
            disabled={inserted}
        >
            Insert content above
        </button>
        <div class="pin-stage">
            {#if inserted}
                <div class="inserted" data-testid="inserted-content">New layout content</div>
            {/if}
            <motion.div
                class="card pin-card"
                data-testid="cross-axis-card"
                drag="x"
                dragMomentum={false}
                layout
            >
                drag x · stay pinned on y
            </motion.div>
        </div>
    </section>

    <section>
        <h2>whileDrag overriding an authored style channel</h2>
        <p class="hint">
            The card authors <code>rotate</code> on <code>style</code>, and <code>whileDrag</code>
            overrides that same channel. Both the override and the drag translation must survive.
        </p>
        <div class="stage">
            <motion.div
                class="card authored-rotate-card"
                data-testid="authored-rotate-card"
                drag="x"
                dragMomentum={false}
                style={{ rotate: -8 }}
                whileDrag={{ rotate: 4 }}
                transition={{ duration: 0.05 }}
            >
                style rotate −8° · whileDrag 4°
            </motion.div>
        </div>
    </section>

    <section>
        <h2>Full gesture stack over authored transform channels</h2>
        <p class="hint">
            Mirrors the docs example: constrained two-axis drag, <code>whileHover</code> and
            <code>whileDrag</code> both owning <code>scale</code>, a spring transition, over
            authored
            <code>rotate</code>/<code>skewX</code>. Drag translation and the whileDrag rotate must
            both survive.
        </p>
        <div bind:this={stackBounds} class="stage stack-stage">
            <motion.div
                class="card gesture-stack-card"
                data-testid="gesture-stack-card"
                drag
                dragConstraints={stackBounds}
                dragElastic={0.28}
                whileHover={{ scale: 1.03 }}
                whileDrag={{ rotate: 4, scale: 1.08, cursor: 'grabbing' }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                style={{ rotate: -8, skewX: -5 }}
            >
                full gesture stack
            </motion.div>
        </div>
    </section>

    <section>
        <h2>3D rotation with perspective</h2>
        <div class="stage perspective-stage">
            <motion.div
                class="card rotate-x-card"
                data-testid="rotate-x-card"
                drag="x"
                dragMomentum={false}
                whileDrag={{ rotateX: 30 }}
                transition={{ duration: 0.05 }}
                style={{ transformPerspective: '600px' }}
            >
                rotateX 30°
            </motion.div>
        </div>
    </section>
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

    h1,
    h2,
    p {
        margin-top: 0;
    }

    section {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid #28504a;
        background: #0b1816;
    }

    .stage,
    .pin-stage {
        min-height: 150px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px dashed #35786c;
        background: #091311;
    }

    .pin-stage {
        margin-top: 12px;
        align-content: start;
        padding: 24px;
    }

    .inserted {
        width: min(420px, 100%);
        height: 72px;
        display: grid;
        place-items: center;
        margin-bottom: 16px;
        border: 1px solid #f59e0b;
        color: #fbbf24;
        background: #2a1c08;
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
        cursor: grab;
        user-select: none;
        touch-action: none;
        will-change: transform;
    }

    :global(.pin-card) {
        width: 220px;
    }

    :global(.rotate-card) {
        transform-origin: center;
    }

    .perspective-stage {
        perspective: 900px;
    }

    .hint {
        margin: 0 0 12px;
        color: #9fd9cd;
        font-size: 13px;
    }

    .stack-stage {
        min-height: 280px;
    }

    button {
        padding: 8px 12px;
        border: 1px solid #76ead3;
        color: #e8fffa;
        background: #12352f;
        font: inherit;
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.55;
        cursor: default;
    }
</style>
