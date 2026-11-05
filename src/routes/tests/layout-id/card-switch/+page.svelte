<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Port of upstream motion `dev/react/src/tests/issue-4042.tsx` @ v14.9.1
    // (https://github.com/motiondivision/motion/issues/4042).
    //
    // Gallery items each have layoutId={color} with a nested
    // layoutId={`dot-${color}`} child. The open card shares both layoutIds
    // with the open item. Opening red, then clicking blue while the card is
    // open (switching the card's layoutIds to blue's), then closing, left the
    // card on screen forever: its exit never completed.
    //
    // e2e/layout-id/card-switch.spec.ts.

    const colors = ['red', 'blue']
    const transition = { duration: 1 }

    let open = $state<string | null>(null)

    // ---- Live verdict (tester only) ----
    //
    // 2.5 s after Close, is `#card` still in the DOM?
    type Verdict = 'waiting' | 'checking' | 'removed' | 'stuck'
    let verdict = $state<Verdict>('waiting')
    let checking = 0

    const close = () => {
        open = null
        const run = ++checking
        verdict = 'checking'
        setTimeout(() => {
            if (run !== checking) return
            verdict = document.getElementById('card') ? 'stuck' : 'removed'
        }, 2500)
    }

    const steps: TesterStep[] = [
        {
            text: 'Click the red square.',
            expected:
                "A red card grows out of the red square, and red's dot grows into the card's dot.",
            action: { label: 'Open red', run: () => (open = 'red') }
        },
        {
            text: 'Once the card is open, click the blue square.',
            expected: "red's dot animates home from the card",
            action: { label: 'Switch to blue', run: () => (open = 'blue') }
        },
        {
            text: 'Click "Close".',
            expected: 'the card shrinks into blue and is removed',
            action: { label: 'Close', run: close }
        }
    ]
</script>

<svelte:head>
    <title>layoutId · an open card that switches item still exits (#4042)</title>
</svelte:head>

<div style="position: relative; width: 600px; height: 500px;">
    <div style="display: flex; gap: 20px;">
        {#each colors as color (color)}
            <motion.div
                id={color}
                layoutId={color}
                onclick={() => (open = color)}
                {transition}
                style="width: 100px; height: 100px; background: {color};"
            >
                <motion.div
                    id="dot-{color}"
                    layoutId="dot-{color}"
                    {transition}
                    style="width: 20px; height: 20px; background: #fff;"
                />
            </motion.div>
        {/each}
    </div>
    <button id="close" type="button" onclick={close}>Close</button>
    <AnimatePresence>
        {#if open}
            <motion.div
                key="card"
                id="card"
                layoutId={open}
                {transition}
                style="position: absolute; top: 200px; left: 200px; width: 300px; height: 200px; background: {open};"
            >
                <motion.div
                    layoutId="dot-{open}"
                    {transition}
                    style="width: 60px; height: 60px; background: #fff;"
                />
            </motion.div>
        {/if}
    </AnimatePresence>
</div>

<TesterPanel
    eyebrow="Motion 14.9.1 · #4042"
    title="An open layoutId card that switches item still exits"
    status="Open red, switch the card to blue, then close it: the card must be removed."
    {steps}
>
    {#snippet summary()}
        <span class="verdict {verdict === 'removed' ? 'ok' : verdict === 'stuck' ? 'bad' : 'na'}">
            {verdict === 'removed'
                ? 'REMOVED'
                : verdict === 'stuck'
                  ? 'STUCK'
                  : verdict === 'checking'
                    ? 'CHECKING #card'
                    : 'WAITING'}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            Upstream #4042: switching an open card's layoutIds to another item, then closing it,
            must still let AnimatePresence remove the card once its 1 s exit is done. Before Motion
            14.9.1 the card stayed on screen forever.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .verdict {
        display: inline-block;
        margin-right: 0.25rem;
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
