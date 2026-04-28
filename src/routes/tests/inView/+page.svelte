<script lang="ts">
    import { useInView } from '$lib'

    let topEl: HTMLElement | undefined = $state(undefined)
    let bottomEl: HTMLElement | undefined = $state(undefined)
    let onceEl: HTMLElement | undefined = $state(undefined)

    const topInView = useInView(() => topEl)
    const bottomInView = useInView(() => bottomEl)
    const onceInView = useInView(() => onceEl, { once: true })
</script>

<svelte:head>
    <title>useInView Test</title>
    <style>
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

<div class="page">
    <header>
        <h1>useInView</h1>
        <p>
            Reports whether each box is in the viewport. Scroll to verify the bottom box toggles,
            and the "once" box latches the first time it enters.
        </p>
    </header>

    <section class="test-section">
        <h2>Top box (visible on load)</h2>
        <div bind:this={topEl} class="box" data-testid="top-box" data-in-view={$topInView}>
            in-view: <strong>{$topInView}</strong>
        </div>
    </section>

    <div class="spacer">Scroll down…</div>

    <section class="test-section">
        <h2>Bottom box (toggles on scroll)</h2>
        <div bind:this={bottomEl} class="box" data-testid="bottom-box" data-in-view={$bottomInView}>
            in-view: <strong>{$bottomInView}</strong>
        </div>
    </section>

    <div class="spacer">Keep scrolling…</div>

    <section class="test-section">
        <h2>Once box (latches on first entry)</h2>
        <div bind:this={onceEl} class="box" data-testid="once-box" data-in-view={$onceInView}>
            in-view: <strong>{$onceInView}</strong>
        </div>
    </section>

    <div class="bottom-spacer"></div>
</div>

<style>
    .page {
        display: block;
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
    }

    .test-section {
        margin: 20px 0;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 8px;
    }

    .spacer {
        height: 1500px;
        min-height: 1500px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(to bottom, #f0f0f0, #e0e0e0);
        border-radius: 8px;
        color: #555;
    }

    .bottom-spacer {
        height: 50vh;
    }

    .box {
        width: 240px;
        height: 120px;
        border-radius: 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
    }
</style>
