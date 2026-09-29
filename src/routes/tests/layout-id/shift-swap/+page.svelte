<script lang="ts">
    import { motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Plan 009 Step 3: ONE state change both shifts a `layoutId` element (a
    // 120px banner appears above the tab strip) and swaps it to its
    // counterpart (the underline moves to another tab). The handoff must start
    // from the PAINTED, pre-shift position — what React's
    // `getSnapshotBeforeUpdate` snapshots — then animate to the new slot.
    // e2e/layout-id/shift-swap.spec.ts.

    const tabs = ['One', 'Two', 'Three'] as const

    let shifted = $state(false)
    const selected = $derived(shifted ? 2 : 0)

    // Strong ease-in: the first animated frame is still within ~0.3px of the
    // start, so the spec can pin the START position to 1px. (With a linear
    // ease one frame of progress is already ~5px along the 280px path.)
    const transition = {
        layout: { type: 'tween' as const, ease: [0.9, 0, 1, 1] as const, duration: 1 }
    }

    const steps: TesterStep[] = [
        {
            text: 'Click “Shift + swap”.',
            expected:
                'A banner appears above the tabs and, in the same instant, the green underline starts from under “One” where it was, then glides down and across to “Three” over 1 second. It never flashes at the new row first.',
            action: { run: () => document.getElementById('toggle')?.click() }
        },
        {
            text: 'Click it again.',
            expected:
                'The banner disappears and the underline glides back from under “Three” to “One”, starting from where it was painted.'
        }
    ]
</script>

<svelte:head>
    <title>layoutId · same-update shift + swap</title>
</svelte:head>

<main style="padding: 24px; font-family: sans-serif;">
    <button id="toggle" type="button" onclick={() => (shifted = !shifted)}>Shift + swap</button>

    {#if shifted}
        <div
            id="banner"
            style="height: 120px; margin-top: 16px; background: #334155; color: white; display: flex; align-items: center; padding: 0 16px; box-sizing: border-box;"
        >
            Banner (120px)
        </div>
    {/if}

    <div id="tabs" style="display: flex; gap: 40px; margin-top: 16px;">
        {#each tabs as tab, index (tab)}
            <div style="position: relative; width: 100px; padding: 8px 0; text-align: center;">
                {tab}
                {#if selected === index}
                    <motion.div
                        layoutId="shift-swap-underline"
                        data-testid="underline"
                        {transition}
                        style="position: absolute; left: 0; right: 0; bottom: -4px; height: 4px; background: #34d399;"
                    />
                {/if}
            </div>
        {/each}
    </div>
</main>

<TesterPanel
    eyebrow="Plan 009 · layoutId handoff"
    title="Same-update shift + swap starts from the painted position"
    status="Passes on this build."
    {steps}
>
    {#snippet checks()}
        <p>
            One click shows a 120px banner above the tab strip <em>and</em> moves the
            <code>layoutId</code> underline to another tab, in a single state change.
        </p>
        <p>
            The handoff must start from where the underline was painted before the click (like
            React's <code>getSnapshotBeforeUpdate</code>), not from where the banner pushed the old
            tab to.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /* Top-anchor the fixture: the root layout centres its content, which
       would halve the banner's shift. */
    :global(.container),
    :global(#sandbox) {
        display: block;
    }
</style>
