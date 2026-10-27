<script lang="ts">
    import { useScroll } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // useScroll returns scrollXLength / scrollYLength: each axis's maximum
    // scroll offset, so the distance from the end is
    // `scrollYLength - scrollY`. Motion 14.7.1 (`623a0e7b6`, #2189).

    const CONTENT_WIDTH = 1000
    const CONTENT_HEIGHT = 1500

    let containerEl = $state<HTMLElement>()
    let h = $state(300)

    const { scrollX, scrollY, scrollXLength, scrollYLength } = useScroll({
        container: () => containerEl
    })

    const remainingY = $derived(Math.round(scrollYLength.current - scrollY.current))
    const yLength = $derived(Math.round(scrollYLength.current))
    // Live verdict: the reported length matches the DOM's own maximum offset.
    // `h` is read so the check re-runs after "Grow container".
    const expectedY = $derived.by(() => {
        void h
        void scrollYLength.current
        return containerEl ? CONTENT_HEIGHT - containerEl.clientHeight : undefined
    })

    const steps: TesterStep[] = [
        {
            text: 'Scroll the box to the bottom.',
            expected: '"remaining" counts down to 0 at the bottom.'
        },
        {
            text: 'Press "Grow container".',
            expected: 'The y length drops from 1200 to 1000 when the box grows.',
            action: { label: 'Grow container', run: () => (h = 500) }
        }
    ]
</script>

<svelte:head>
    <title>useScroll scrollXLength / scrollYLength</title>
</svelte:head>

<main class="scroll-length">
    <h1>useScroll · scroll lengths</h1>

    <!--
        `scrollbar-width: none` keeps clientWidth / clientHeight at exactly
        400 / 300 (500 after growing), so the 600 / 1200 / 1000 lengths don't
        depend on whether the browser draws scrollbars (headless Chromium may
        or may not run with --hide-scrollbars).
    -->
    <div
        bind:this={containerEl}
        data-testid="container"
        style="width: 400px; height: {h}px; overflow: auto; position: relative; scrollbar-width: none; border: 0; background: #1e293b;"
    >
        <div
            style="width: {CONTENT_WIDTH}px; height: {CONTENT_HEIGHT}px; background: linear-gradient(135deg, #334155, #0f172a);"
        ></div>
    </div>

    <button data-testid="grow" type="button" onclick={() => (h = 500)}>Grow container</button>

    <dl class="readouts">
        <dt>scrollX</dt>
        <dd data-testid="scroll-x">{Math.round(scrollX.current)}</dd>
        <dt>scrollY</dt>
        <dd data-testid="scroll-y">{Math.round(scrollY.current)}</dd>
        <dt>scrollXLength</dt>
        <dd data-testid="scroll-x-length">{Math.round(scrollXLength.current)}</dd>
        <dt>scrollYLength</dt>
        <dd data-testid="scroll-y-length">{yLength}</dd>
        <dt>remaining (y)</dt>
        <dd data-testid="remaining-y">{remainingY}</dd>
    </dl>
</main>

<TesterPanel
    eyebrow="useScroll · scroll lengths"
    title="scrollYLength is the maximum scroll offset"
    status="Motion 14.7.1 (#2189)."
    {steps}
>
    {#snippet summary()}
        {#if expectedY !== undefined && yLength === expectedY}
            <span class="verdict ok">OK</span>
        {:else}
            <span class="verdict bad">MISMATCH</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            <code>scrollYLength</code> should equal the content height minus the box's visible
            height (expected <strong>{expectedY ?? '–'}</strong>, reported
            <strong>{yLength}</strong>).
        </p>
    {/snippet}
</TesterPanel>

<style>
    main {
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
    }
    h1 {
        font-size: 1.5rem;
        font-weight: 700;
    }
    button {
        padding: 0.4rem 0.9rem;
        border-radius: 0.5rem;
        background: #2563eb;
        color: white;
    }
    .readouts {
        display: grid;
        grid-template-columns: auto auto;
        gap: 0.25rem 1rem;
        font-family: ui-monospace, monospace;
    }
    .verdict {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
</style>
