<script lang="ts">
    import { motion } from '$lib/index'

    // Track which elements have animated for test verification
    let inViewportAnimated = $state(false)
    let belowFoldAnimated = $state(false)

    // Track whileInView specifically (separate from main animation)
    let belowFoldInViewTriggered = $state(false)
</script>

<svelte:head>
    <title>whileInView Test</title>
    <style>
        /* Override root layout to allow scrolling for this test page */
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

<div class="while-in-view-container">
    <h1>whileInView Test</h1>
    <p>
        Tests that whileInView triggers correctly for elements already in viewport and elements
        scrolled into view.
    </p>

    <!-- Test 1: Element already in viewport on page load -->
    <section class="test-section" data-testid="in-viewport-section">
        <h2>Test 1: Already in Viewport</h2>
        <p>This element should animate immediately on page load.</p>
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onAnimationComplete={() => (inViewportAnimated = true)}
            data-testid="in-viewport-box"
            data-animated={inViewportAnimated}
            style="width: 200px; height: 100px; background: #4ade80; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; margin-top: 10px;"
        >
            In Viewport
        </motion.div>
    </section>

    <!-- Spacer to push next element below fold -->
    <div class="spacer" data-testid="spacer" style="height: 1500px; min-height: 1500px;">
        <p>Scroll down to see the next test element...</p>
    </div>

    <!-- Test 2: Element below fold - needs scrolling -->
    <section class="test-section" data-testid="below-fold-section">
        <h2>Test 2: Below Fold (Scroll to Reveal)</h2>
        <p>This element should animate when scrolled into view.</p>
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            onInViewStart={() => (belowFoldInViewTriggered = true)}
            onAnimationComplete={() => (belowFoldAnimated = true)}
            data-testid="below-fold-box"
            data-animated={belowFoldAnimated}
            data-inview-triggered={belowFoldInViewTriggered}
            style="width: 200px; height: 100px; background: #60a5fa; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; margin-top: 10px;"
        >
            Below Fold
        </motion.div>
    </section>

    <!-- Extra space at bottom for scrolling -->
    <div class="bottom-spacer"></div>
</div>

<style>
    .while-in-view-container {
        display: block;
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
    }

    h1 {
        margin-bottom: 10px;
    }

    .test-section {
        margin: 20px 0;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 8px;
    }

    .box {
        width: 200px;
        height: 100px;
        background: #4ade80;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        margin-top: 10px;
    }

    .box-secondary {
        background: #60a5fa;
    }

    .spacer {
        height: 1500px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(to bottom, #f0f0f0, #e0e0e0);
        margin: 20px 0;
        border-radius: 8px;
    }

    .bottom-spacer {
        height: 50vh;
    }
</style>
