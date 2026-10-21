<script lang="ts">
    import { animate, useScopeMotion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Motion 14.5 scope media conditions through `useScopeMotion`.
     *
     * `matchMedia: { desktop: '>=800', mobile: '<800' }`: setup writes
     * `scope.media` into `data-testid="media"` and animates the box to
     * `x: 200` on desktop or `x: 50` on mobile. Crossing 800px cancels the
     * scope (restoring the box's inline style) and re-runs setup, so the box
     * re-animates from 0 to the new target.
     *
     * The `data-testid`s are what `e2e/scope-motion/media.spec.ts` drives;
     * keep them stable.
     */
    let media = $state<Record<string, boolean>>({})
    let runs = $state(0)

    const scope = useScopeMotion(
        (s) => {
            runs += 1
            media = { ...s.media }
            animate('[data-testid="box"]', { x: s.media.desktop ? 200 : 50 })
        },
        {
            transition: { duration: 0.3 },
            matchMedia: { desktop: '>=800', mobile: '<800' }
        }
    )

    const label = $derived(media.desktop ? 'desktop' : media.mobile ? 'mobile' : 'none')

    // ---- Live viewport readout (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let width = $state(0)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        const update = () => (width = window.innerWidth)
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    })

    const expected = $derived(width >= 800 ? 'desktop' : 'mobile')

    const steps: TesterStep[] = [
        {
            text: 'Load the page in a window at least 800px wide.',
            expected: 'Media reads "desktop" and the box glides 200px right.'
        },
        {
            text: 'Make the window narrower than 800px (or open devtools device mode).',
            expected:
                'Media flips to "mobile". The box jumps back to the start, then glides 50px right. The chip reads MATCH.'
        },
        {
            text: 'Widen the window past 800px again.',
            expected: 'Media reads "desktop" and the box glides to 200px again.'
        }
    ]
</script>

<svelte:head>
    <title>scopeMotion — media conditions</title>
</svelte:head>

<main class="page">
    <header>
        <p class="kicker">useScopeMotion · matchMedia</p>
        <h1>Setup re-runs when a breakpoint flips.</h1>
        <p class="lede">
            <code>matchMedia: &#123; desktop: '&gt;=800', mobile: '&lt;800' &#125;</code>. The box
            goes to 200px on desktop and 50px on mobile.
        </p>
    </header>

    <section class="card" {@attach scope}>
        <div class="track">
            <div class="box" data-testid="box"></div>
        </div>
        <p class="stats">
            media: <span data-testid="media">{label}</span> · raw:
            <span data-testid="media-json">{JSON.stringify(media)}</span> · setup runs:
            <span data-testid="runs">{runs}</span>
            {#if isTester}
                <span class="verdict" class:ok={label === expected} data-tester-verdict="media">
                    {label === expected ? 'MATCH' : 'MISMATCH'} · window {width}px
                </span>
            {/if}
        </p>
    </section>
</main>

<TesterPanel
    eyebrow="useScopeMotion (Motion 14.5)"
    title="Media conditions refresh the scope"
    status="Expected to pass on this build: the media label follows the window width and the box settles at 200px (desktop) or 50px (mobile)."
    {steps}
>
    {#snippet checks()}
        <p>
            With <code>matchMedia</code>, the scope only runs setup while a condition matches and
            exposes each named condition on <code>scope.media</code>. When one changes, the scope is
            cancelled (inline styles restored) and setup runs again.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        min-height: 100vh;
        padding: 32px;
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
        max-width: 520px;
        margin-bottom: 24px;
        opacity: 0.75;
    }

    .card {
        display: grid;
        gap: 16px;
        max-width: 480px;
        padding: 24px;
        border-radius: 16px;
        background: #1a1d24;
    }

    .track {
        padding: 8px;
        border-radius: 12px;
        background: #111318;
    }

    .box {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        background: #6366f1;
    }

    .stats {
        font-family: monospace;
        opacity: 0.8;
    }

    .verdict {
        margin-left: 8px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }
</style>
