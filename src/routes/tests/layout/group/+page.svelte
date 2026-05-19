<script lang="ts">
    import { AnimatePresence, LayoutGroup, motion } from '$lib'

    // Regression test for <LayoutGroup> scoping (#311).
    //
    // Two sibling tab strips share an identical `layoutId="underline"` but
    // live in separate <LayoutGroup>s. Clicking tab 2 on the right strip
    // must NOT pull the underline from the left strip across the page —
    // each group keeps its own animation scope.
    //
    // A third strip (bottom) has no <LayoutGroup> wrapping it. With a stray
    // `layoutId="underline"` in a third location, the un-grouped strip
    // would historically reach into whichever sibling unmounted most
    // recently. The LayoutGroup-wrapped strips above prove the isolation
    // works.
    //
    // Playwright e2e drives the two grouped strips and asserts the
    // un-bridged-x property (Δleft well under page width).

    let selectedA = $state(0)
    let selectedB = $state(0)

    const tabs = [0, 1, 2] as const

    const underlineStyle =
        'position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: royalblue; border-radius: 2px;'
</script>

<svelte:head>
    <title>LayoutGroup · regression test</title>
</svelte:head>

<div class="page" data-testid="layout-group-page">
    <header>
        <h1>
            <code>&lt;LayoutGroup&gt;</code> isolation regression test
        </h1>
        <p>
            Two tab strips share an identical <code>layoutId="underline"</code>. Wrapping each in
            its own <code>&lt;LayoutGroup&gt;</code> keeps their animations independent — clicking in
            the right strip must not pull the underline from the left strip across the page.
        </p>
    </header>

    <section class="strips">
        <LayoutGroup id="strip-a">
            <div class="strip" data-testid="strip-a" data-active-tab={selectedA}>
                {#each tabs as id (id)}
                    <button
                        type="button"
                        class="tab"
                        data-testid="strip-a-tab-{id}"
                        onclick={() => (selectedA = id)}
                    >
                        Tab {id}
                        <AnimatePresence>
                            {#if selectedA === id}
                                <motion.div
                                    key="underline"
                                    layoutId="underline"
                                    data-testid="strip-a-underline"
                                    style={underlineStyle}
                                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                                ></motion.div>
                            {/if}
                        </AnimatePresence>
                    </button>
                {/each}
            </div>
        </LayoutGroup>

        <LayoutGroup id="strip-b">
            <div class="strip" data-testid="strip-b" data-active-tab={selectedB}>
                {#each tabs as id (id)}
                    <button
                        type="button"
                        class="tab"
                        data-testid="strip-b-tab-{id}"
                        onclick={() => (selectedB = id)}
                    >
                        Tab {id}
                        <AnimatePresence>
                            {#if selectedB === id}
                                <motion.div
                                    key="underline"
                                    layoutId="underline"
                                    data-testid="strip-b-underline"
                                    style={underlineStyle}
                                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                                ></motion.div>
                            {/if}
                        </AnimatePresence>
                    </button>
                {/each}
            </div>
        </LayoutGroup>
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
    p {
        color: #444;
        line-height: 1.5;
        margin: 0;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 0.85em;
        background: #f3f3f3;
        padding: 0 4px;
        border-radius: 3px;
    }
    .strips {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 48px;
    }
    .strip {
        display: flex;
        gap: 4px;
        justify-content: center;
        border: 1px dashed #ccc;
        padding: 16px;
        border-radius: 8px;
    }
    .tab {
        position: relative;
        padding: 0.5rem 1.25rem;
        border: none;
        background: transparent;
        font-weight: 500;
        cursor: pointer;
    }
</style>
