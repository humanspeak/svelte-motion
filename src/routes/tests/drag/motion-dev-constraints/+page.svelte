<script lang="ts">
    import { motion } from '$lib'

    let bounds: HTMLElement | null = null
</script>

<svelte:head>
    <title>Drag constraints · Motion.dev parity</title>
</svelte:head>

<main class="page" data-testid="motion-dev-constraints-page">
    <section class="example-shell" aria-label="Motion.dev drag constraints parity example">
        <div class="constraint-stage" bind:this={bounds} data-testid="motion-dev-constraint-box">
            <motion.div
                class="drag-handle"
                drag
                dragConstraints={bounds}
                whileDrag={{ cursor: 'grabbing' }}
                data-testid="motion-dev-drag-card"
                aria-label="Draggable constrained card"
            />
        </div>
    </section>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #020617;
    }

    .page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        overflow: hidden;
        background:
            radial-gradient(circle at 50% 50%, rgb(15 23 42 / 0.72), transparent 38rem),
            linear-gradient(180deg, #020617 0%, #030712 100%);
    }

    .example-shell {
        width: min(100vw, 980px);
        height: min(100vh, 680px);
        display: grid;
        place-items: center;
    }

    .constraint-stage {
        width: clamp(260px, 42vw, 430px);
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        border: 1px solid rgb(148 163 184 / 0.18);
        border-radius: 34px;
        background:
            linear-gradient(rgb(15 23 42 / 0.82), rgb(15 23 42 / 0.82)) padding-box,
            linear-gradient(135deg, rgb(96 165 250 / 0.24), rgb(168 85 247 / 0.18)) border-box;
        box-shadow:
            0 24px 80px rgb(0 0 0 / 0.34),
            inset 0 1px 0 rgb(255 255 255 / 0.06);
    }

    :global(.drag-handle) {
        width: clamp(84px, 12vw, 116px);
        aspect-ratio: 1;
        border-radius: 26px;
        cursor: grab;
        background: #0ea5e9;
        box-shadow:
            0 22px 60px rgb(14 165 233 / 0.38),
            inset 0 1px 0 rgb(255 255 255 / 0.32);
        touch-action: none;
    }
</style>
