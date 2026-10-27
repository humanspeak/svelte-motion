<script lang="ts">
    /**
     * Port of upstream `dev/react/src/tests/drag-ref-constraints-shift.tsx`
     * (Motion 14.7.1, `337c7de73`).
     *
     * A draggable with ref constraints, moved down the page together with its
     * constraints without either re-rendering, so their layout isn't measured
     * again. Its drag constraints must still hold. Upstream added this guard
     * while fixing #2024, so the fix only re-measures ref constraints when a
     * `layoutScroll` ancestor scrolled (`6e56b3883`). It passes on 14.6.0 too.
     *
     * - `?` (default) — the content above grows (`window.grow()`)
     * - `?sticky` — the block sits in a sticky header and the page scrolls
     *
     * Deviation: the root is `position: absolute; top: 0; left: 0` because the
     * app layout flex-centres every page (`app.css` `#sandbox` / `.container`)
     * and the spec asserts exact page positions (constraints at y = 200 after
     * growing, 0 when sticky). In sticky mode the 3000px child still gives the
     * document its scroll height.
     *
     * @component
     */
    import { page } from '$app/state'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import Draggable from './Draggable.svelte'

    const sticky = page.url.searchParams.has('sticky')

    let height = $state(0)

    // ---- Live verdict (tester only) ----
    //
    // After a drag ends, check whether the square's bottom-right corner sits
    // on the grey box's bottom-right corner (within 1px).

    let corner = $state<{ dx: number; dy: number } | null>(null)

    onMount(() => {
        const w = window as unknown as { grow?: () => void }
        w.grow = () => (height = 200)
        if (window.location.search.includes('@isPlaywright=true')) return () => delete w.grow

        const up = () => {
            // Read after the release has been applied.
            requestAnimationFrame(() => {
                const box = document.querySelector('[data-testid="box"]')
                const area = document.querySelector('[data-testid="constraints"]')
                if (!box || !area) return
                const b = box.getBoundingClientRect()
                const a = area.getBoundingClientRect()
                corner = { dx: b.right - a.right, dy: b.bottom - a.bottom }
            })
        }
        window.addEventListener('pointerup', up)
        return () => {
            delete w.grow
            window.removeEventListener('pointerup', up)
        }
    })

    const atCorner = $derived(
        corner !== null && Math.abs(corner.dx) <= 1 && Math.abs(corner.dy) <= 1
    )

    const steps: TesterStep[] = [
        {
            text: sticky
                ? 'Scroll the page down a little, then drag the red square to the far bottom-right.'
                : "Click 'grow', then drag the red square to the far bottom-right.",
            expected: "It follows the pointer and stops exactly at the grey box's corner.",
            action: sticky ? undefined : { label: 'grow', run: () => (height = 200) }
        }
    ]
</script>

<svelte:head>
    <title>Drag · ref constraints hold when the page moves both boxes</title>
</svelte:head>

<div class="root">
    {#if sticky}
        <div style="height: 3000px">
            <div style="height: 100px"></div>
            <div style="position: sticky; top: 0">
                <Draggable />
            </div>
        </div>
    {:else}
        <div data-testid="spacer" style="height: {height}px"></div>
        <Draggable />
    {/if}
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · ref constraints guard"
    title="Ref constraints hold when the page moves both boxes"
    status="Passes on Motion 14.6.0 and 14.7.1 (guard for the #2024 fix)."
    {steps}
>
    {#snippet summary()}
        {#if corner === null}
            <span class="verdict na">WAITING</span>
        {:else if atCorner}
            <span class="verdict ok">AT CORNER ✓</span>
        {:else}
            <span class="verdict bad">
                OFF ✗ ({Math.round(corner.dx)}px, {Math.round(corner.dy)}px)
            </span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The red square uses the grey box as <code>dragConstraints</code>. The page then moves
            both down ({sticky
                ? 'a sticky header while the page scrolls'
                : 'content above them grows by 200px'}) without re-rendering either, so their layout
            is not measured again.
        </p>
        <p>
            The constraints must still hold: dragged far to the bottom-right, the square stops with
            its corner on the grey box's corner. The chip checks that after each release.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /* Escape the app layout's flex centring: the spec asserts page positions. */
    .root {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        margin: 0;
        padding: 0;
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
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
