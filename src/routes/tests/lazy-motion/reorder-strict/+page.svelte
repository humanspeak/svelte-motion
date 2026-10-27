<script lang="ts">
    import { page } from '$app/state'
    import { LazyMotion, Reorder, domMax, m } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Port of Motion's `dev/react/src/tests/issue-2094.tsx` @ v14.7.1.
     *
     * #2094: the page sits in `<LazyMotion strict>` and renders the MAIN
     * `Reorder`, which renders `motion` components. In development it warns
     * once, pointing at `@humanspeak/svelte-motion/m`, instead of throwing;
     * either way it keeps reordering. `?features=async` loads `domMax` with a
     * dynamic import, as in the reporter's repro.
     *
     * The `data-testid`s are what `e2e/lazy-motion/reorder-strict.spec.ts`
     * drives; keep them stable.
     */
    const isAsync = page.url.searchParams.get('features') === 'async'

    let items = $state([0, 1, 2])

    const steps: TesterStep[] = [
        {
            text: 'Open the console, then drag item 0 down past item 1 and let go.',
            expected:
                'The order becomes 1, 0, 2 and the page keeps working. In `pnpm dev` the console shows ONE warning that ends with "For Reorder, import it from \\"@humanspeak/svelte-motion/m\\"" (production builds print nothing).'
        },
        {
            text: 'Drag a few more items around.',
            expected: 'Still exactly one LazyMotion warning in the console.'
        }
    ]
</script>

<svelte:head>
    <title>LazyMotion — main Reorder in strict mode (#2094)</title>
</svelte:head>

<div class="page">
    <h1>LazyMotion — main Reorder in strict mode (#2094)</h1>
    <p>
        The main <code>Reorder</code> inside <code>&lt;LazyMotion strict&gt;</code> ({isAsync
            ? 'async'
            : 'sync'} features), next to an <code>m.div</code>.
    </p>

    <LazyMotion strict features={isAsync ? () => import('$lib').then((mod) => mod.domMax) : domMax}>
        <m.div data-testid="m-sibling" animate={{ opacity: 1 }}></m.div>
        <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next: number[]) => (items = next)}
            style="list-style: none; margin: 0; padding: 0;"
        >
            {#each items as item (item)}
                <Reorder.Item
                    value={item}
                    data-testid={`item-${item}`}
                    style="height: 50px; width: 200px; margin-bottom: 10px; background: red; color: white; display: flex; align-items: center; justify-content: center; user-select: none; -webkit-user-select: none;"
                >
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
    </LazyMotion>

    <dl>
        <dt>order</dt>
        <dd data-testid="order">{items.join(',')}</dd>
    </dl>
</div>

<TesterPanel
    eyebrow="LazyMotion · Motion 14.7.0 (#2094)"
    title="The main Reorder warns once in strict mode"
    status="Expected to pass on this build."
    {steps}
>
    {#snippet checks()}
        <p>
            The main <code>Reorder</code> renders <code>motion</code> components, which strict mode
            rejects. Users render <code>Reorder</code>, not <code>motion</code>, so instead of
            throwing it warns once in development and names the fix: the <code>m</code> entry's
            <code>Reorder</code>.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    h1 {
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        max-width: 560px;
        margin-bottom: 24px;
        color: #9ca3af;
    }

    dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 4px 12px;
        margin-top: 24px;
        font-family: monospace;
    }

    dt {
        color: #6b7280;
    }
</style>
