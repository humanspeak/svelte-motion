<script lang="ts">
    import { animateLayout } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Shared-element handoff with Motion 14.1's vanilla `animateLayout`: the
     * underline is a plain `<div data-layout-id="underline">` rendered under
     * the selected tab only. Selecting a tab removes it from one tab and
     * mounts a new one under another in the same Svelte flush, and
     * `animateLayout` animates the new element from the old one's box.
     *
     * The `data-testid`s are what `e2e/animate-layout/shared.spec.ts`
     * drives; keep them stable.
     */
    const DURATION = 0.5
    const TABS = ['Home', 'Docs', 'Examples', 'Blog'] as const

    let selected = $state<string>(TABS[0])
    let settled = $state(0)

    const select = async (tab: string) => {
        if (tab === selected) return
        watch()
        await animateLayout(() => (selected = tab), { duration: DURATION })
        settled += 1
    }

    // ---- Glide meter (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let verdict = $state<{ frames: number; glided: boolean } | null>(null)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    /** Counts frames where the underline sits strictly between its two tabs. */
    const watch = () => {
        if (!isTester) return
        const lefts: number[] = []
        const start = performance.now()
        const sample = () => {
            const left = document
                .querySelector('[data-testid="underline"]')
                ?.getBoundingClientRect().left
            if (left !== undefined) lefts.push(left)
            if (performance.now() - start < (DURATION + 0.4) * 1000) {
                requestAnimationFrame(sample)
                return
            }
            const lo = Math.min(lefts[0], lefts[lefts.length - 1]) + 1
            const hi = Math.max(lefts[0], lefts[lefts.length - 1]) - 1
            const frames = lefts.filter((left) => left > lo && left < hi).length
            verdict = { frames, glided: frames >= 3 }
        }
        requestAnimationFrame(sample)
    }

    const steps: TesterStep[] = [
        {
            text: 'Click "Blog", then "Home".',
            expected:
                'The underline slides across the tabs to the one you picked, and stretches to its width. The chip reads GLIDED.',
            action: { label: 'Go to Blog', run: () => select('Blog') }
        },
        {
            text: 'Click two tabs quickly, one after the other.',
            expected:
                'The underline changes course mid-flight toward the second tab, without jumping back first.'
        }
    ]
</script>

<svelte:head>
    <title>animateLayout — shared underline</title>
</svelte:head>

<main class="page">
    <header>
        <p class="kicker">animateLayout · data-layout-id</p>
        <h1>A shared underline, no motion components.</h1>
        <p class="lede">
            Only the selected tab renders the underline. Switching tabs swaps which tab owns it, and
            <code>animateLayout</code> carries it across.
        </p>
    </header>

    <nav class="tabs" data-testid="tabs">
        {#each TABS as tab (tab)}
            <button
                type="button"
                class="tab"
                class:selected={selected === tab}
                data-testid="tab-{tab.toLowerCase()}"
                onclick={() => select(tab)}
            >
                {tab}
                {#if selected === tab}
                    <div class="underline" data-layout-id="underline" data-testid="underline"></div>
                {/if}
            </button>
        {/each}
    </nav>

    <p class="stats" data-testid="settled">settled:{settled} selected:{selected}</p>
    {#if isTester && verdict}
        <p class="verdict" class:ok={verdict.glided}>
            {verdict.glided ? 'GLIDED' : 'SNAPPED'} · {verdict.frames} frames
        </p>
    {/if}
</main>

<TesterPanel
    eyebrow="animateLayout (Motion 14.1)"
    title="The underline slides between tabs"
    status="Expected to pass on this build: every switch reads GLIDED."
    {steps}
>
    {#snippet checks()}
        <p>
            Elements that share a <code>data-layout-id</code> hand off to each other: when one
            leaves and another arrives in the same update, the newcomer animates from the old one's
            position and size. Here Svelte removes and mounts the underline elements, and the
            wrapper flushes that change before <code>animateLayout</code> measures it.
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
        margin-bottom: 32px;
        opacity: 0.75;
    }

    .tabs {
        display: flex;
        gap: 4px;
        width: fit-content;
        padding: 6px;
        border-radius: 14px;
        background: #1a1d24;
    }

    .tab {
        position: relative;
        padding: 12px 20px;
        border: none;
        background: none;
        color: #9ca3af;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
    }

    /* Widths differ per tab so the handoff also animates size. */
    .tab:nth-child(3) {
        padding-inline: 32px;
    }

    .tab.selected {
        color: white;
    }

    .underline {
        position: absolute;
        right: 8px;
        bottom: 4px;
        left: 8px;
        height: 3px;
        border-radius: 3px;
        background: #6366f1;
    }

    .stats {
        margin-top: 24px;
        font-family: monospace;
        opacity: 0.6;
    }

    .verdict {
        display: inline-block;
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
