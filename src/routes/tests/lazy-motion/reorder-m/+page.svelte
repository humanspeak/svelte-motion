<script lang="ts">
    import { page } from '$app/state'
    import { LazyMotion, domMax, type FeatureBundle } from '$lib'
    import { Reorder } from '$lib/m'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Port of Motion's `dev/react/src/tests/reorder-lazy-motion.tsx` @ v14.7.1.
     *
     * #2232: `Reorder` from the `m` entry renders `m` components, so it gets
     * drag and layout from a strict LazyMotion. With `?features=async` they
     * load when `window.loadFeatures()` is called, so the list is inert until
     * then.
     *
     * The `data-testid`s are what `e2e/lazy-motion/reorder-lazy-motion.spec.ts`
     * drives; keep them stable.
     */
    type LoadFeaturesWindow = Window & { loadFeatures?: () => void }

    const isAsync = page.url.searchParams.get('features') === 'async'

    let loaded = $state(!isAsync)
    let items = $state(['a', 'b', 'c'])

    /** Resolves `domMax` once `window.loadFeatures()` (or the button) runs. */
    const asyncFeatures = (): Promise<FeatureBundle> =>
        new Promise((resolve) => {
            ;(window as LoadFeaturesWindow).loadFeatures = () => {
                loaded = true
                resolve(domMax)
            }
        })

    const loadNow = () => (window as LoadFeaturesWindow).loadFeatures?.()

    const steps: TesterStep[] = [
        {
            text: 'Without ?features=async: drag "a" down past "b" and let go.',
            expected: 'The order becomes b, a, c. No LazyMotion warning in the console.'
        },
        {
            text: 'Open this page with ?features=async and drag "a" down past "b".',
            expected: 'Nothing moves: the list is inert until its features load.'
        },
        {
            text: 'Press "Load features", then drag "a" down past "b" again.',
            expected: 'The list now reorders to b, a, c.',
            action: { label: 'Load features', run: loadNow }
        }
    ]
</script>

<svelte:head>
    <title>LazyMotion — Reorder from the m entry (#2232)</title>
</svelte:head>

<div class="page">
    <h1>LazyMotion — Reorder from the m entry (#2232)</h1>
    <p>
        <code>Reorder</code> from <code>@humanspeak/svelte-motion/m</code> inside
        <code>&lt;LazyMotion strict&gt;</code> ({isAsync ? 'async' : 'sync'} features, {loaded
            ? 'loaded'
            : 'not loaded'}).
    </p>

    <LazyMotion strict features={isAsync ? asyncFeatures : domMax}>
        <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next: string[]) => (items = next)}
            style="list-style: none; margin: 0; padding: 0;"
        >
            {#each items as item (item)}
                <Reorder.Item
                    value={item}
                    data-testid={item}
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
    eyebrow="LazyMotion · Motion 14.7.0 (#2232)"
    title="Reorder gets its features from LazyMotion"
    status="Expected to pass on this build."
    {steps}
>
    {#snippet checks()}
        <p>
            The <code>m</code> entry's <code>Reorder</code> renders <code>m</code> components, so it
            only drags once the surrounding <code>LazyMotion</code> provides <code>domMax</code>,
            and
            <code>strict</code> mode doesn't complain about it.
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
