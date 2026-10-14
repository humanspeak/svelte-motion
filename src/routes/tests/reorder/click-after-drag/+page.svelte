<script lang="ts">
    import { Reorder } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Port of Motion's `dev/react/src/tests/issue-2682.tsx` @ v14.2.0.
     *
     * #2682: dragging the lower `Reorder.Item` above the upper one fired its
     * click (and the group's), while dragging the upper one below the lower
     * one fired nothing. A release that ends a reordering drag should click
     * nothing either way; a drag that doesn't reorder, or a plain click,
     * clicks as before.
     *
     * The `data-testid`s are what `e2e/reorder/click-after-drag.spec.ts`
     * drives; keep them stable.
     */
    let items = $state(['a', 'b'])
    let clicks = $state<string[]>([])

    // ---- Release verdicts (tester only; the panel hides under Playwright) ----
    type Verdict = { reordered: boolean; clicked: string; ok: boolean }
    let verdict = $state<Verdict | null>(null)
    let orderAtPress = ''
    let clicksAtPress = 0

    /**
     * Snapshots the order and click count at each press, then, once the
     * release has settled, records whether the release reordered and what it
     * clicked. A reordering release must click nothing; any other release
     * must click.
     */
    const onPressStart = () => {
        orderAtPress = items.join(',')
        clicksAtPress = clicks.length
    }
    const onPressEnd = () => {
        setTimeout(() => {
            const reordered = items.join(',') !== orderAtPress
            const clicked = clicks.slice(clicksAtPress).join(',')
            verdict = { reordered, clicked, ok: reordered ? clicked === '' : clicked !== '' }
        }, 500)
    }

    const steps: TesterStep[] = [
        {
            text: 'Drag the red "a" item down past the blue "b" item and let go.',
            expected:
                'The order becomes b,a and the click log stays empty. The chip reads PASS · reordered, no click.'
        },
        {
            text: 'Drag the red "a" item back up past "b" and let go.',
            expected:
                'The order returns to a,b and the click log is still empty. Before the fix, this direction logged "a,group".'
        },
        {
            text: 'Drag the blue "b" item up a little (not past "a") and let go.',
            expected:
                'The order stays a,b and the log gains "b,group": a drag that doesn’t reorder still clicks.'
        },
        {
            text: 'Click the red "a" item without dragging.',
            expected: 'The log gains "a,group".'
        }
    ]
</script>

<svelte:head>
    <title>Reorder — click after drag (#2682)</title>
</svelte:head>

<div class="page">
    <h1>Reorder — click after drag (#2682)</h1>
    <p>
        Releasing a drag that reorders the list shouldn’t click the item or the group, whichever
        direction you drag. Drags that don’t reorder, and plain clicks, click as usual.
    </p>

    <Reorder.Group
        axis="y"
        values={items}
        onReorder={(next: string[]) => (items = next)}
        onclick={() => (clicks = [...clicks, 'group'])}
        onpointerdown={onPressStart}
        onpointerup={onPressEnd}
        data-testid="reorder-group"
        style="list-style: none; padding: 0; margin: 0;"
    >
        {#each items as item (item)}
            <Reorder.Item
                value={item}
                id="item-{item}"
                data-testid="item-{item}"
                onclick={() => (clicks = [...clicks, item])}
                style="height: 80px; width: 200px; margin: 0; background: {item === 'a'
                    ? 'red'
                    : 'blue'}; color: white; display: flex; align-items: center; justify-content: center; font: 600 20px system-ui; user-select: none; -webkit-user-select: none; cursor: grab;"
            >
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>

    <dl>
        <dt>clicks</dt>
        <dd data-testid="clicks">{clicks.join(',')}</dd>
        <dt>order</dt>
        <dd data-testid="order">{items.join(',')}</dd>
    </dl>
</div>

<TesterPanel
    eyebrow="Reorder · Motion 14.1.1 (#2682)"
    title="A reordering release clicks nothing"
    status="Expected to pass on this build: every release reads PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            Browsers only fire <code>click</code> on an element that contains both the press and the
            release target. A reorder moves DOM nodes mid-press, so before the fix whether the item
            and group got a click depended on drag direction. <code>Reorder.Group</code> now swallows
            the click that follows a reordering release.
        </p>
    {/snippet}
    {#snippet summary()}
        {#if verdict}
            <span class="verdict" class:ok={verdict.ok} data-tester-verdict="release">
                {verdict.ok ? 'PASS' : 'FAIL'} · {verdict.reordered ? 'reordered' : 'no reorder'},
                {verdict.clicked ? `clicked ${verdict.clicked}` : 'no click'}
            </span>
        {:else}
            <span class="verdict pending">Waiting for a release…</span>
        {/if}
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

    .verdict {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        color: white;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }

    .verdict.pending {
        background: #374151;
    }
</style>
