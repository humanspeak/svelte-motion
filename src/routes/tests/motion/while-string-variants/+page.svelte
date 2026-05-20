<script lang="ts">
    import { motion } from '$lib'

    // Regression page for #349 — variant string keys on whileX props.
    //
    // Each box exercises a different whileX prop with a variant *string*
    // (or array of strings) instead of inline keyframes. Hovering /
    // tapping / focusing / entering-viewport should produce the same
    // visual result as inline-form props.
    //
    // The Playwright e2e drives `box-while-hover-string` (hover scales
    // to 1.25) and `box-while-hover-array` (hover scales to 1.25 *and*
    // tints — the array's later entry wins on `backgroundColor`).

    const tabVariants = {
        hovered: { scale: 1.25 },
        tinted: { backgroundColor: '#22c55e' },
        focused: { outline: '4px solid #2563eb', outlineOffset: '4px' },
        pressed: { scale: 0.8 },
        visible: { opacity: 1, y: 0 }
    }

    const baseBox =
        'width: 96px; height: 96px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-family: system-ui;'
</script>

<svelte:head>
    <title>whileX string variants · regression test</title>
    <style>
        /* The root layout locks page scroll for most demos. The whileInView
           card needs real page scroll so the IntersectionObserver fires when
           the box scrolls into the viewport — un-lock for this route only.
           Pattern lifted from /tests/motion/while-in-view. */
        html,
        body {
            height: auto !important;
            overflow: auto !important;
        }
        body > .container,
        body > div > .container,
        #sandbox,
        .test-layout {
            display: block !important;
            height: auto !important;
            min-height: auto !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
            overflow: visible !important;
        }
    </style>
</svelte:head>

<div class="page" data-testid="while-string-variants-page">
    <header>
        <h1>
            <code>whileX</code> variant string keys (#349)
        </h1>
        <p>
            Each card passes a variant key (or array) to one of <code>whileHover</code> /
            <code>whileTap</code> / <code>whileFocus</code> / <code>whileInView</code> instead of an inline
            keyframes object. The effect should be visually indistinguishable from the equivalent inline
            form.
        </p>
    </header>

    <section class="grid">
        <article>
            <h2>whileHover — single string</h2>
            <motion.div
                data-testid="box-while-hover-string"
                variants={tabVariants}
                whileHover="hovered"
                style="{baseBox} background: #ef4444;"
            >
                hover me
            </motion.div>
        </article>

        <article>
            <h2>whileHover — array (later wins)</h2>
            <motion.div
                data-testid="box-while-hover-array"
                variants={tabVariants}
                whileHover={['hovered', 'tinted']}
                style="{baseBox} background: #f97316;"
            >
                hover me
            </motion.div>
        </article>

        <article>
            <h2>whileTap — single string</h2>
            <motion.button
                data-testid="box-while-tap-string"
                type="button"
                variants={tabVariants}
                whileTap="pressed"
                style="{baseBox} background: #6366f1; border: none; cursor: pointer;"
            >
                press me
            </motion.button>
        </article>

        <article>
            <h2>whileFocus — single string</h2>
            <motion.button
                data-testid="box-while-focus-string"
                type="button"
                variants={tabVariants}
                whileFocus="focused"
                style="{baseBox} background: #14b8a6; border: none; cursor: pointer;"
            >
                tab to me
            </motion.button>
        </article>
    </section>

    <section class="inview-section">
        <h2>whileInView — single string</h2>
        <p class="inview-hint">
            Scroll down — the purple box below uses <code>whileInView="visible"</code> and fades up when
            it enters the viewport.
        </p>
        <div class="inview-spacer"></div>
        <motion.div
            data-testid="box-while-inview-string"
            variants={tabVariants}
            initial={{ opacity: 0, y: 40 }}
            whileInView="visible"
            style="{baseBox} background: #a855f7;"
        >
            scroll to me
        </motion.div>
        <div class="inview-tail"></div>
    </section>
</div>

<style>
    .page {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    header {
        margin-bottom: 24px;
    }
    h1 {
        font-size: 1.4rem;
        margin: 0 0 0.5rem;
    }
    h2 {
        font-size: 0.9rem;
        margin: 0 0 0.75rem;
        color: #444;
    }
    p {
        color: #444;
        line-height: 1.5;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 0.85em;
        background: #f3f3f3;
        padding: 0 4px;
        border-radius: 3px;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 24px;
    }
    article {
        border: 1px solid #ddd;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #fafafa;
    }
    .inview-section {
        margin-top: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    .inview-hint {
        max-width: 480px;
        margin: 0 0 1.5rem;
    }
    .inview-spacer {
        height: 80vh;
    }
    .inview-tail {
        height: 40vh;
    }
</style>
