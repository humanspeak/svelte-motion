<script lang="ts">
    /**
     * Port of upstream `dev/react/src/tests/issue-1831.tsx` (Motion 14.7.1,
     * `d850bb38b`; motion-dom fix `a280595ea`).
     *
     * #1831: a draggable slide (based on the image-gallery example) whose
     * `animate` prop is a list of variant labels. Releasing the drag
     * deactivates `whileDrag`, and before 14.7.1 that re-ran every `animate`
     * label and fired `onAnimationComplete` once per label, with nothing
     * animating. Every `onAnimationComplete` call is logged to
     * `window.completed` so the spec can check whether a release fires it.
     *
     * - `?single=true` — `animate="center"` instead of the label list
     *
     * `window.completed` is initialised in the script body, before the box
     * mounts, so the mount animation's completion is recorded (the spec waits
     * for it).
     *
     * @component
     */
    import { page } from '$app/state'
    import { motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    type CompletedWindow = Window & { completed: string[] }

    const variants = {
        base: { x: 300, opacity: 0 },
        exiting: { x: -300, opacity: 0 },
        center: { x: 0, opacity: 1 }
    }

    const single = page.url.searchParams.get('single') === 'true'
    const animate = single ? 'center' : ['base', 'exiting', 'center']

    if (typeof window !== 'undefined') (window as unknown as CompletedWindow).completed = []

    // ---- Live verdict (tester only) ----
    //
    // Mirror the completion log, and count the entries that arrived since the
    // last pointer release.

    let log = $state<string[]>([])
    let sinceRelease = $state<number | null>(null)

    const handleComplete = (definition: unknown) => {
        const label = String(definition)
        ;(window as unknown as CompletedWindow).completed.push(label)
        log = [...log, label]
        if (sinceRelease !== null) sinceRelease += 1
    }

    const steps: TesterStep[] = [
        {
            text: 'Drag the box sideways a little and let go.',
            expected: 'It springs back; the completion log below stays empty.'
        }
    ]
</script>

<svelte:head>
    <title>Drag · release doesn't fire onAnimationComplete per animate label (#1831)</title>
</svelte:head>

<svelte:window onpointerup={() => (sinceRelease = 0)} />

<motion.div
    data-testid="box"
    {variants}
    initial="base"
    {animate}
    transition={{ duration: 0.2 }}
    drag="x"
    dragConstraints={{ left: 0, right: 0 }}
    dragElastic={1}
    onAnimationComplete={handleComplete}
    style="position: absolute; top: 100px; left: 200px; width: 200px; height: 200px; background: red"
/>

<TesterPanel
    eyebrow="Motion 14.7.1 · #1831"
    title="Drag release doesn't fire onAnimationComplete per animate label"
    status="Fails on Motion 14.6.0 (one completion per label on release); passes from Motion 14.7.1."
    {steps}
>
    {#snippet summary()}
        {#if sinceRelease === null}
            <span class="verdict na">WAITING</span>
        {:else if sinceRelease === 0}
            <span class="verdict ok">OK</span>
        {:else}
            <span class="verdict bad">FIRED ✗ ×{sinceRelease}</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The box has <code>animate={single ? '"center"' : '["base", "exiting", "center"]'}</code>
            and springs back to <code>x: 0</code> on release (zero-width constraints). Releasing a
            drag doesn't change <code>animate</code>, so <code>onAnimationComplete</code> shouldn't fire.
            Before Motion 14.7.1 it fired once per label as soon as you let go.
        </p>
        <p>Completion log: <code>{log.length ? log.join(', ') : '(empty)'}</code></p>
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
