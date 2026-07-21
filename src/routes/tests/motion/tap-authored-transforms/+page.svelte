<script lang="ts">
    /**
     * Characterization page for whileTap over style-authored transform
     * channels. The button centers itself with `x: '-50%', y: '-50%'`
     * (framer-parity authoring for transform-centering); pressing must
     * compose the tap scale with those channels — losing them shifts the
     * element by half its size (its top-left corner lands where its
     * center should be).
     *
     * @component
     */
    import { motion } from '$lib'
</script>

<svelte:head>
    <title>Motion · whileTap over authored transforms</title>
</svelte:head>

<main>
    <h1>whileTap over authored transforms</h1>
    <p>
        The button is centered via style-authored <code>x: '-50%', y: '-50%'</code> channels;
        <code>whileHover</code> and <code>whileTap</code> scale it. Every gesture phase must keep the
        button centered — lost channels read as a half-size jump down-right.
    </p>

    <section>
        <div class="stage">
            <motion.button
                data-testid="tap-authored-center-button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    x: '-50%',
                    y: '-50%',
                    width: '180px',
                    height: '56px'
                }}
            >
                press me
            </motion.button>
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
        padding: 24px 0 48px;
    }

    .stage {
        position: relative;
        height: 320px;
        border: 1px dashed #2b4a44;
    }

    :global(.stage button) {
        border: 1px solid #4ff0b7;
        background: rgba(79, 240, 183, 0.12);
        color: #e8fffa;
        cursor: pointer;
    }
</style>
