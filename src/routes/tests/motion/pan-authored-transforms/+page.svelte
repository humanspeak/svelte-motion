<script lang="ts">
    /**
     * Characterization page for whilePan overriding a transform channel
     * that `style` also authors. The pan-start animation must compose
     * with the authored channels, and pan-end must restore the
     * style-authored value smoothly — not settle to neutral and snap.
     *
     * @component
     */
    import { motion } from '$lib'
</script>

<svelte:head>
    <title>Motion · whilePan over authored transforms</title>
</svelte:head>

<main>
    <h1>whilePan over authored transforms</h1>
    <p>
        The card authors <code>rotate</code> on <code>style</code>; <code>whilePan</code>
        overrides the same channel with a spring. Pan-start must animate −8° → 4°, and pan-end must return
        smoothly to −8°.
    </p>

    <section>
        <div class="stage">
            <motion.div
                class="card"
                data-testid="pan-authored-rotate-card"
                whilePan={{ rotate: 4 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                style={{ rotate: -8 }}
            >
                style −8° · pan 4°
            </motion.div>
        </div>
    </section>

    <h2>whilePan keys with no authored value</h2>
    <p>
        <code>whilePan</code> also owns keys the element never authored: an animatable one (<code
            >opacity</code
        >, over an <code>animate</code> value) and a non-animatable inline one (<code>cursor</code
        >). Both must revert when the pan ends — the restore has to come from the node's own base
        target, not from whatever the element happens to look like mid-pan.
    </p>

    <section>
        <div class="stage">
            <motion.div
                class="card"
                data-testid="pan-unauthored-keys-card"
                whilePan={{ opacity: 0.4, cursor: 'grabbing' }}
                animate={{ opacity: 0.9 }}
                transition={{ duration: 0.15 }}
            >
                animate 0.9 · pan 0.4
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
    p {
        margin-top: 0;
    }

    section {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid #28504a;
        background: #0b1816;
    }

    .stage {
        min-height: 200px;
        display: grid;
        place-items: center;
        border: 1px dashed #35786c;
        background: #091311;
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
</style>
