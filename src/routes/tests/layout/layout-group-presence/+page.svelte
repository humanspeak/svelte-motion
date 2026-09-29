<script lang="ts">
    import { AnimatePresence, LayoutGroup, motion } from '$lib'
    import JumpRecorder from '../_parity/JumpRecorder.svelte'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    // Plan 007 D7: LayoutGroup `forceRender` after AnimatePresence exits
    // (upstream AnimatePresence calls the nearest LayoutGroup's `forceRender`
    // once every exit completes; e2e/layout/layout-group-parity/
    // layout-group-unmount.spec.ts).
    //
    // #a exits inside AnimatePresence; #b is a `layout` sibling in the same
    // LayoutGroup. While #a's exit runs, its placeholder (margins included)
    // holds the slot, so #b must not move. Once the exit finishes and #a
    // leaves the layout, #b animates up into the freed space exactly once —
    // no snap, no restart.

    let showA = $state(true)

    const box = 'width: 100px; height: 100px; border-radius: 20px; margin: 20px;'

    const steps: TesterStep[] = [
        {
            text: 'Click the red box (#a) to remove it.',
            expected:
                'Blue stays put while red fades. After red is gone, blue glides up once into the empty space over 1 second, without jumping.',
            action: { run: () => document.getElementById('a')?.click() }
        },
        {
            text: 'Press "Reset page" at the top of this panel and watch blue closely during the first third of a second after clicking red again.',
            expected:
                'Blue does not move at all while red is still visible — no 40px hop up at the start of the fade.'
        },
        {
            text: 'Press "Reset page" and watch the boxes appear.',
            expected:
                'Red is on top and blue below it from the very first frame. Blue never flashes in red’s spot. The pop recorder below (and in the bar) should say SMOOTH for “Page load”.'
        },
        {
            text: 'If you ever see a pop, look at the pop recorder.',
            expected:
                'It says POP DETECTED with the frame number. Press Copy under the frame trace and send us the text.'
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
    status="Passes on this build in headless e2e. A one-frame pop of blue into red’s spot after “Reset page” has been seen by hand but not reproduced headless — the pop recorder is here to catch it."
    {steps}
>
    {#snippet checks()}
        <p>
            The red box exits inside <code>AnimatePresence</code>; the blue box is a
            <code>layout</code> sibling in the same <code>LayoutGroup</code>.
        </p>
        <p>
            While red fades, its exit placeholder keeps red's full slot — margins included — so blue
            holds still. When red's exit completes, the group re-measures (upstream's
            <code>forceRender</code>) and blue animates into the freed space exactly once.
        </p>
    {/snippet}
    <!-- Red's exit (0.3 s) holds the slot, then blue glides for 1 s: it can't reach the
         settle spot before ~1.3 s (minus 50 ms of frame-timing slack). -->
    <JumpRecorder
        targetId="b"
        triggerId="a"
        durationMs={2000}
        jumpPx={30}
        earliestSettleMs={1250}
    />
</TesterPanel>

<style>
    :global(.container),
    :global(#sandbox) {
        display: block;
    }
</style>
