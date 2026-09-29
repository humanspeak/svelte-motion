<script lang="ts">
    import { AnimatePresence, LayoutGroup, motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    // Plan 007 D7: LayoutGroup `forceRender` after AnimatePresence exits
    // (upstream AnimatePresence calls the nearest LayoutGroup's `forceRender`
    // once every exit completes; e2e/layout/layout-group-parity/
    // layout-group-unmount.spec.ts).
    //
    // #a exits inside AnimatePresence; #b is a `layout` sibling in the same
    // LayoutGroup. Once #a's exit finishes and it leaves the layout, #b must
    // animate up into the freed space exactly once — no snap, no restart.

    let showA = $state(true)

    const box = 'width: 100px; height: 100px; border-radius: 20px; margin: 20px;'

    const steps: TesterStep[] = [
        {
            text: 'Click the red box (#a) to remove it.',
            expected:
                'Red fades out. Then the blue box (#b) glides up into the empty space over 1 second, once, without jumping.',
            action: { run: () => document.getElementById('a')?.click() }
        }
    ]
</script>

<svelte:head>
    <title>LayoutGroup · AnimatePresence exit frees space</title>
</svelte:head>

<LayoutGroup id="presence-group">
    <div id="stack" style="display: flex; flex-direction: column; align-items: flex-start;">
        <AnimatePresence>
            {#if showA}
                <motion.div
                    key="a"
                    id="a"
                    layout
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style="{box} background: red;"
                    onclick={() => (showA = false)}
                />
            {/if}
        </AnimatePresence>
        <motion.div
            id="b"
            layout
            transition={{ layout: { type: 'tween', ease: 'linear', duration: 1 } }}
            style="{box} background: blue;"
        />
    </div>
</LayoutGroup>

<TesterPanel
    eyebrow="Plan 007 · LayoutGroup forceRender"
    title="A sibling fills the space an exit frees"
    status="Passes on this build."
    {steps}
>
    {#snippet checks()}
        <p>
            The red box exits inside <code>AnimatePresence</code>; the blue box is a
            <code>layout</code> sibling in the same <code>LayoutGroup</code>.
        </p>
        <p>
            When red's exit completes, the group re-measures (upstream's
            <code>forceRender</code>) and blue animates into the freed space exactly once.
        </p>
    {/snippet}
</TesterPanel>

<style>
    :global(.container),
    :global(#sandbox) {
        display: block;
        min-height: 0;
    }
</style>
