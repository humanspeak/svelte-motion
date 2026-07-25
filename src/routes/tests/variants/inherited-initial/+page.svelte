<script lang="ts">
    import { motion, type Variants } from '$lib'

    /**
     * The canonical upstream variants pattern: the PARENT owns the variant
     * labels (`initial="closed"`, `animate={open ? 'open' : 'closed'}`) and the
     * children carry ONLY a `variants` map. Children must render at the
     * inherited `closed` pose from the very first frame — otherwise the first
     * expand click animates to a pose they already visually occupy and appears
     * to do nothing (the operator-found sign-off blocker, plan 006).
     *
     * No spring: a fixed duration keeps the e2e mid-flight sampling meaningful.
     */
    let open = $state(false)

    const childVariants: Variants = {
        closed: { opacity: 0, y: 24 },
        open: { opacity: 1, y: 0 }
    }
</script>

<svelte:head>
    <title>Variants — inherited initial first paint</title>
</svelte:head>

<div class="page">
    <h1>Inherited initial label on first paint</h1>
    <p class="expectation">
        The three children declare only <code>variants</code>. On first paint they must sit at the
        parent's inherited <code>closed</code> pose (opacity 0, y 24), and the first
        <code>Toggle</code> must ANIMATE them in rather than snap.
    </p>

    <button type="button" data-testid="toggle" onclick={() => (open = !open)}>
        Toggle ({open ? 'open' : 'closed'})
    </button>

    <motion.div
        class="stack"
        data-testid="parent"
        initial="closed"
        animate={open ? 'open' : 'closed'}
        transition={{ duration: 0.35, ease: 'linear' }}
    >
        {#each [0, 1, 2] as index (index)}
            <motion.div class="child" data-testid={`child-${index}`} variants={childVariants}>
                Child {index + 1}
            </motion.div>
        {/each}
    </motion.div>
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 32px;
        font-family: system-ui, sans-serif;
    }

    h1 {
        font-size: 1.5rem;
        font-weight: 700;
    }

    .expectation {
        max-width: 40rem;
        text-align: center;
        color: #444;
        font-size: 0.9rem;
    }

    button {
        border: 1px solid #cbd5f5;
        border-radius: 8px;
        background: #eef2ff;
        padding: 8px 16px;
        cursor: pointer;
    }

    :global(.stack) {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 260px;
    }

    :global(.child) {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 56px;
        border-radius: 12px;
        background: #22d3ee;
        color: #0f1115;
        font-weight: 600;
        user-select: none;
    }
</style>
