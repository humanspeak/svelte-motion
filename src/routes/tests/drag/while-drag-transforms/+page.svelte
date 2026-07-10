<script lang="ts">
    /**
     * Characterization page for transform channels that the drag composer
     * currently overwrites or fails to paint while the pointer is held.
     */
    import { motion } from '$lib'

    let inserted = $state(false)
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
