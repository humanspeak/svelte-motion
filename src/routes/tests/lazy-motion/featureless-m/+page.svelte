<script lang="ts">
    import { LazyMotion, domAnimation, domMax, m, type FeatureBundle } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * An `m` component with no LazyMotion features (plan 016, upstream parity).
     *
     * Upstream (Motion 14.7.1 `render/components/m/create.ts`,
     * `motion/utils/use-visual-element.ts`) an `m` gets its renderer only from
     * `<LazyMotion>`. With none above it, or while an async bundle is loading,
     * it has no VisualElement: it renders `style` and `initial` and does
     * nothing else. When the bundle arrives it animates in from `initial`.
     *
     * Cards: a bare `m.div`; an `m.div` in an async LazyMotion whose loader
     * resolves when "Load features" is pressed; and a control `m.div` in a
     * sync `domAnimation` LazyMotion.
     *
     * The `data-testid`s are what `e2e/lazy-motion/featureless-m.spec.ts`
     * drives; keep them stable.
     */
    type Card = 'bare' | 'async' | 'control'

    let releaseFeatures: ((bundle: FeatureBundle) => void) | undefined
    const featuresReady = new Promise<FeatureBundle>((resolve) => {
        releaseFeatures = resolve
    })
    const loadFeatures = () => featuresReady
    let loaded = $state(false)
    const load = () => {
        loaded = true
        releaseFeatures?.(domMax)
    }

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let opacities = $state<Partial<Record<Card, number>>>({})

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return
        let frame = 0
        const sample = () => {
            for (const card of ['bare', 'async', 'control'] as Card[]) {
                const el = document.querySelector<HTMLElement>(`[data-testid="card-${card}"]`)
                if (el) opacities[card] = Number(getComputedStyle(el).opacity)
            }
            frame = requestAnimationFrame(sample)
        }
        frame = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(frame)
    })

    /** The opacity upstream settles on for each card right now. */
    const expectedOpacity = (card: Card) =>
        card === 'control' || (card === 'async' && loaded) ? 1 : 0.4

    const steps: TesterStep[] = [
        {
            text: 'Wait a second after the page loads. Hover each card.',
            expected:
                'Bare card: stays faded and small (opacity 0.4, scale 0.8) and does not grow on hover. Async card: the same. Control card: fades in to full size and grows on hover. All three chips read OK.'
        },
        {
            text: 'Press "Load features".',
            expected:
                'The async card fades in from 0.4 to 1 and grows to full size, then grows on hover. Its chip reads OK. The bare card does not change.',
            action: { label: 'Load features', run: load }
        }
    ]
</script>

<svelte:head>
    <title>LazyMotion — m without features</title>
</svelte:head>

{#snippet verdictChip(card: Card)}
    {#if isTester && opacities[card] !== undefined}
        <span class="verdict" class:ok={Math.abs(opacities[card]! - expectedOpacity(card)) < 0.01}>
            {Math.abs(opacities[card]! - expectedOpacity(card)) < 0.01 ? 'OK' : 'WRONG'} · opacity
            {opacities[card]!.toFixed(2)} (want {expectedOpacity(card)})
        </span>
    {/if}
{/snippet}

<main class="page">
    <header>
        <p class="kicker">LazyMotion · Motion 14.7.1 m/create.ts</p>
        <h1>An m without features does nothing.</h1>
        <p class="lede">
            Upstream, an <code>m</code> gets its renderer only from <code>&lt;LazyMotion&gt;</code>.
            Without one, or while an async bundle loads, it renders its <code>initial</code> and stays
            there. When the bundle arrives it animates in.
        </p>
    </header>

    <button type="button" data-testid="load" onclick={load} disabled={loaded}>
        Load features
    </button>

    <section class="card">
        <h2>Bare m.div {@render verdictChip('bare')}</h2>
        <m.div
            data-testid="card-bare"
            class="box"
            initial={{ opacity: 0.4, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.15 }}
        >
            bare
        </m.div>
    </section>

    <section class="card">
        <h2>m.div in an async LazyMotion {@render verdictChip('async')}</h2>
        <LazyMotion features={loadFeatures}>
            <m.div
                data-testid="card-async"
                class="box"
                initial={{ opacity: 0.4, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.15 }}
            >
                async
            </m.div>
        </LazyMotion>
    </section>

    <section class="card">
        <h2>Control: m.div in LazyMotion domAnimation {@render verdictChip('control')}</h2>
        <LazyMotion features={domAnimation}>
            <m.div
                data-testid="card-control"
                class="box"
                initial={{ opacity: 0.4, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.15 }}
            >
                control
            </m.div>
        </LazyMotion>
    </section>
</main>

<TesterPanel
    eyebrow="render/components/m/create.ts (Motion 14.7.1)"
    title="An m without features renders initial only"
    status="Expected on this build: all three cards read OK."
    {steps}
>
    {#snippet checks()}
        <p>
            A featureless <code>m</code> has no VisualElement upstream: no enter animation, no
            hover, no projection. It still renders <code>style</code> and <code>initial</code>. When
            an async LazyMotion bundle loads, the <code>m</code> gets its VisualElement and animates
            in from <code>initial</code>.
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

    .kicker {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.6;
    }

    h1 {
        margin: 4px 0 8px;
        font-size: 24px;
    }

    .lede {
        max-width: 560px;
        margin-bottom: 24px;
        opacity: 0.75;
    }

    .card {
        display: grid;
        gap: 16px;
        max-width: 560px;
        margin: 20px 0;
        padding: 24px;
        border-radius: 16px;
        background: #1a1d24;
    }

    h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 16px;
    }

    :global(.box) {
        display: grid;
        place-items: center;
        width: 120px;
        height: 80px;
        border-radius: 12px;
        background: #6366f1;
        font-family: monospace;
    }

    .verdict {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }

    button {
        padding: 10px 18px;
        border: 0;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
