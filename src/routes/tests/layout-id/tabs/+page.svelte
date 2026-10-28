<script lang="ts">
    import { page } from '$app/state'
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Port of upstream motion `dev/react/src/tests/issue-1411-tabs.tsx` @
    // v14.7.1 (https://github.com/motiondivision/motion/issues/1411, commits
    // 7f85889ed and 32abe31f7).
    //
    // Tabs where every tab renders its highlight, and only the selected one
    // has the layoutId. When the selection changes, the new highlight animates
    // from the old one, with or without `layout` (`?layout=true`).
    // e2e/layout-id/tabs.spec.ts.

    const layout = page.url.searchParams.get('layout') === 'true'

    let selected = $state('a')

    // ---- Live verdict (tester only) ----
    //
    // After each selection change, sample the new highlight's left edge for
    // 1.2 s. It SLID if any sample landed between 20% and 80% of the way,
    // SNAPPED if every sample sat at an end, and HIDDEN if the tab that gave
    // up the layoutId was hidden at any point.

    type Verdict = 'waiting' | 'sampling' | 'slid' | 'snapped' | 'hidden'
    let verdict = $state<Verdict>('waiting')

    /** How long each change is sampled for, in ms. */
    const SAMPLE_MS = 1200
    /** Distance between the two highlights' slots, in px. */
    const DISTANCE = 300

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return

        let raf = 0
        let watching: { to: string; from: string; start: number } | null = null
        let slid = false
        let hidden = false
        let last = selected
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            if (selected !== last) {
                watching = { to: selected, from: last, start: now }
                last = selected
                slid = false
                hidden = false
                verdict = 'sampling'
            }
            if (!watching) return
            const target = document.getElementById(watching.to)
            const origin = document.getElementById(watching.from)
            const slotA = document.getElementById('select-a')?.parentElement
            if (!target || !origin || !slotA) return
            const left = target.getBoundingClientRect().left - slotA.getBoundingClientRect().left
            const progress = watching.to === 'b' ? left / DISTANCE : 1 - left / DISTANCE
            if (progress > 0.2 && progress < 0.8) slid = true
            if (getComputedStyle(origin).visibility === 'hidden') hidden = true
            if (now - watching.start >= SAMPLE_MS) {
                verdict = hidden ? 'hidden' : slid ? 'slid' : 'snapped'
                watching = null
            }
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const click = (id: string) => document.getElementById(id)?.click()

    const steps: TesterStep[] = [
        {
            text: 'Select tab "b".',
            expected:
                'The red highlight slides from under "a" to under "b" over one second, rather than jumping. The chip reads SLID ✓.',
            action: { label: 'Select b', run: () => click('select-b') }
        },
        {
            text: 'Select tab "a" again.',
            expected:
                'The highlight slides back to "a". Neither box disappears. The chip reads SLID ✓.',
            action: { label: 'Select a', run: () => click('select-a') }
        },
        {
            text: 'Open the "with layout" variant from the link in the panel and repeat both steps.',
            expected: 'Same: it slides both ways and the chip reads SLID ✓.'
        }
    ]
</script>

<svelte:head>
    <title>layoutId · tabs without conditional rendering (#1411)</title>
</svelte:head>

<div style="position: relative;">
    {#each ['a', 'b'] as id, i (id)}
        <button
            id={'select-' + id}
            type="button"
            onclick={() => (selected = id)}
            style="position: absolute; top: 0; left: {i * 300}px;"
        >
            {id}
        </button>
    {/each}
    {#each ['a', 'b'] as id, i (id)}
        <motion.div
            {id}
            layout={layout || undefined}
            layoutId={selected === id ? 'highlight' : undefined}
            transition={{ duration: 1, ease: 'linear' }}
            style="position: absolute; top: 50px; left: {i *
                300}px; width: 100px; height: 100px; background: {selected === id
                ? 'red'
                : 'transparent'};"
        />
    {/each}
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · #1411"
    title="Tabs: the layoutId moves between mounted highlights"
    status="Passes on this build (Motion 14.7.1)."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict === 'slid'
                ? 'ok'
                : verdict === 'snapped' || verdict === 'hidden'
                  ? 'bad'
                  : 'na'}"
        >
            {verdict === 'slid'
                ? 'SLID ✓'
                : verdict === 'snapped'
                  ? 'SNAPPED ✗'
                  : verdict === 'hidden'
                    ? 'HIDDEN ✗'
                    : verdict === 'sampling'
                      ? 'SAMPLING'
                      : 'WAITING'}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            Each tab renders its own highlight, and only the selected one has
            <code>layoutId="highlight"</code>
            (<code>layoutId=&#123;selected === id ? 'highlight' : undefined&#125;</code>). Changing
            the selection moves the id between two elements that both stay mounted.
        </p>
        <p>
            Since Motion 14.7.1 (#1411), that move works like an unmount and remount: the new holder
            animates from the old one. Before, the element kept its old shared-layout stack, so the
            highlight snapped.
        </p>
        <p>
            Variant: <a href="?layout=true">with <code>layout</code></a> ·
            <a href="?">without</a>
        </p>
    {/snippet}
</TesterPanel>

<style>
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
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
