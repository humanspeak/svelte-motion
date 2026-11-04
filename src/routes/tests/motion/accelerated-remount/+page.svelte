<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Svelte equivalent of upstream motion
    // `dev/react/src/tests/suspense-remount-running-animation.tsx` @ v14.9.1
    // (https://github.com/motiondivision/motion/issues/4027).
    //
    // Upstream remounts the box through a Suspense boundary while its
    // accelerated opacity animation is past its duration but hasn't finished,
    // as when a busy main thread holds up the finish event. Svelte has no
    // Suspense: a `key` change on the same motion element is our remount, and
    // its rewind to `initial` goes through `MotionValue.jump()`.
    //
    // e2e/motion/accelerated-remount.spec.ts.

    let key = $state(0)
    let remounted = $state(false)
    let opacity = $state<number | null>(null)

    onMount(() => {
        // Remount from a task of its own, a couple of frames into the
        // animation, so Motion's frame time isn't reused for it.
        const remountInNewTask = () => {
            const channel = new MessageChannel()
            channel.port1.onmessage = remount
            channel.port2.postMessage(null)
        }

        const remount = () => {
            const start = performance.now()
            while (performance.now() - start < 300) {
                // Hold up the main thread past the animation's duration
            }
            key++
            remounted = true
            // Tester readout: the box's opacity once the replay has settled
            setTimeout(() => {
                const box = document.getElementById('box')
                if (box) opacity = parseFloat(getComputedStyle(box).opacity)
            }, 500)
        }

        requestAnimationFrame(() => requestAnimationFrame(remountInNewTask))
    })

    const steps: TesterStep[] = [
        {
            text: 'Reload the page; the box ends fully opaque',
            expected:
                'The blue box fades in, is remounted while the main thread is busy, and replays to fully opaque. The chip reads OPACITY 1.',
            action: { label: 'Reload', run: () => location.reload() }
        }
    ]
</script>

<svelte:head>
    <title>motion · remount during an accelerated animation (#4027)</title>
</svelte:head>

{#if remounted}<div id="remounted"></div>{/if}
<AnimatePresence>
    <motion.div
        id="box"
        {key}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
        style="width: 100px; height: 100px; background: blue;"
    />
</AnimatePresence>

<TesterPanel
    eyebrow="Motion 14.9.1 · #4027"
    title="Remount during an accelerated animation"
    status="A key change while the opacity animation is overdue must replay it to its target."
    {steps}
>
    {#snippet summary()}
        <span class="verdict {opacity === null ? 'na' : opacity === 1 ? 'ok' : 'bad'}">
            {opacity === null ? 'WAITING' : `OPACITY ${opacity}`}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            Upstream #4027: a key change rewinds the box through MotionValue.jump() while its
            accelerated opacity animation is past its duration but not yet finished. The replayed
            enter animation must still take it to opacity 1.
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
