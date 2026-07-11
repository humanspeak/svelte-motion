<script lang="ts">
    /**
     * Characterization page for whileHover overriding a transform channel
     * that `style` also authors. The hover-enter animation must compose
     * with the authored channels, and hover-leave must restore the
     * style-authored value smoothly — not settle to neutral and snap.
     *
     * @component
     */
    import { motion } from '$lib'
</script>

<svelte:head>
    <title>Motion · whileHover over authored transforms</title>
</svelte:head>

<main>
    <h1>whileHover over authored transforms</h1>
    <p>
        The card authors <code>rotate</code> on <code>style</code>; <code>whileHover</code>
        overrides the same channel with a spring. Enter must animate −8° → 4°, and leave must return smoothly
        to −8°.
    </p>

    <section>
        <div class="stage">
            <motion.div
                class="card"
                data-testid="hover-authored-rotate-card"
                whileHover={{ rotate: 4 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                style={{ rotate: -8 }}
            >
                style −8° · hover 4°
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
    }
</style>
