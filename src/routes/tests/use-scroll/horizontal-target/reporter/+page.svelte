<script lang="ts">
    import { page } from '$app/state'
    import TesterPanel, { type TesterStep } from '../../../layout/_parity/TesterPanel.svelte'
    import Indicator from './Indicator.svelte'

    // Port of Motion's `dev/react/src/tests/issue-2546-reporter.tsx` @ v14.7.1
    // (#2546, fixed in `8dce64350`): twelve 70vw items in a fixed, full-width
    // horizontal scroller, each drawing a ring from its own scrollXProgress.
    // Before the fix every ring showed the container's progress instead.
    // ?axis=x adds axis: 'x'.

    const axis = page.url.searchParams.get('axis') === 'x' ? ('x' as const) : undefined

    let containerEl = $state<HTMLElement>()

    const steps: TesterStep[] = [
        {
            text: 'Scroll the row of rings sideways.',
            expected:
                "Each ring fills as its own item slides from the right edge to the left edge: rings to the left are full, rings to the right are empty, and they don't all move together."
        }
    ]
</script>

<svelte:head>
    <title>useScroll horizontal target reporter (#2546)</title>
</svelte:head>

<header style="height: 10vh;">header</header>
<main
    bind:this={containerEl}
    id="container"
    data-testid="container"
    class="reporter-2546"
    style="position: fixed; height: 90vh; width: 100vw; overflow-x: auto; overflow-y: hidden;"
>
    <div style="display: flex; flex-flow: row nowrap;">
        {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
            <Indicator index={i} container={() => containerEl} {axis} />
        {/each}
    </div>
</main>

<TesterPanel
    eyebrow="useScroll · horizontal target reporter (#2546)"
    title="Each ring tracks its own item"
    status={axis ? "axis: 'x'" : 'axis: default'}
    {steps}
>
    {#snippet checks()}
        <p>
            Every ring uses <code>useScroll(&#123; container, target &#125;)</code> in the same
            horizontal scroller. Its <code>scrollXProgress</code> must follow its own item. Before Motion
            14.7.1 all rings showed the scroller's overall progress and moved in step.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /*
     * The offsets use vw, which motion resolves against
     * documentElement.clientWidth. The test app's layout can make the document
     * taller than the viewport (and add a vertical scrollbar that shrinks
     * clientWidth), so the page itself must not scroll.
     */
    :global(html:has(main.reporter-2546)),
    :global(html:has(main.reporter-2546) body) {
        overflow: hidden !important;
    }
</style>
