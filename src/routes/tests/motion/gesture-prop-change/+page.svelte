<script lang="ts">
    import { motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Changing a gesture prop while the gesture is active must not re-attach
    // the gesture (plan 006). Upstream keeps one Feature per gesture and reads
    // props at event time: `framer-motion/src/gestures/hover.ts`,
    // `gestures/focus.ts` and `motion/features/viewport/index.ts` at v14.14.0.

    let hoverScale = $state(1.2)
    let hoverStarts = $state(0)
    let hoverEnds = $state(0)
    let focusScale = $state(1.2)
    let focusStarts = $state(0)
    let focusEnds = $state(0)
    let inViewOpacity = $state(1)
    let inViewAmount = $state<'some' | number>('some')
    let inViewStarts = $state(0)

    // Keys, not buttons: moving the pointer to a button would end the hover.
    const onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'h') hoverScale = hoverScale === 1.2 ? 1.4 : 1.2
        else if (event.key === 'f') focusScale = focusScale === 1.2 ? 1.4 : 1.2
        else if (event.key === 'v') inViewOpacity = inViewOpacity === 1 ? 0.9 : 1
    }

    const steps: TesterStep[] = [
        {
            text: 'Hover the pink box, press H while still over it, then move away.',
            expected: 'It grows to 1.4× on H and returns to 1× when you leave. Hover end reads 1.'
        },
        {
            text: 'Press Tab until the Focus button is focused, press F, then press Tab again.',
            expected:
                'It grows to 1.4× on F and returns to 1× when focus moves on. Focus end reads 1.'
        },
        {
            text: 'Press V, then click Change amount.',
            expected: 'In-view starts stays at 1.'
        }
    ]
</script>

<svelte:head>
    <title>Gesture props changed mid-gesture</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<main class="gesture-prop-change">
    <section>
        <motion.div
            data-testid="hover-box"
            class="target"
            style="background-color: #e11d48;"
            animate={{ scale: 1 }}
            whileHover={{ scale: hoverScale }}
            onHoverStart={() => hoverStarts++}
            onHoverEnd={() => hoverEnds++}
        >
            Hover
        </motion.div>
        <p>
            start: <strong data-testid="hover-starts">{hoverStarts}</strong> · end:
            <strong data-testid="hover-ends">{hoverEnds}</strong>
        </p>
    </section>

    <section>
        <motion.button
            data-testid="focus-box"
            class="target"
            style="background-color: #7c3aed;"
            animate={{ scale: 1 }}
            whileFocus={{ scale: focusScale }}
            onFocusStart={() => focusStarts++}
            onFocusEnd={() => focusEnds++}
        >
            Focus
        </motion.button>
        <p>
            start: <strong data-testid="focus-starts">{focusStarts}</strong> · end:
            <strong data-testid="focus-ends">{focusEnds}</strong>
        </p>
    </section>

    <section>
        <motion.div
            data-testid="in-view-box"
            data-amount={String(inViewAmount)}
            class="target"
            style="background-color: #22aa66;"
            initial={{ opacity: 0.2 }}
            whileInView={{ opacity: inViewOpacity }}
            viewport={{ once: true, amount: inViewAmount }}
            onInViewStart={() => inViewStarts++}
        >
            In view
        </motion.div>
        <p>in-view starts: <strong data-testid="in-view-starts">{inViewStarts}</strong></p>
        <button
            data-testid="toggle-amount"
            type="button"
            onclick={() => (inViewAmount = inViewAmount === 'some' ? 0.5 : 'some')}
        >
            Change amount
        </button>
    </section>
</main>

<TesterPanel
    eyebrow="gestures/hover.ts, viewport/index.ts"
    title="Gesture props changed mid-gesture"
    {steps}
>
    {#snippet checks()}
        <p>
            Changing <code>whileHover</code>, <code>whileFocus</code> or <code>whileInView</code>
            while the gesture is active applies the new target without re-attaching the gesture: hover
            and focus still end, and a <code>once</code> in-view fires once.
        </p>
    {/snippet}
</TesterPanel>

<style>
    main {
        display: flex;
        gap: 2rem;
        padding: 2rem;
    }
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }
    :global(.target) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 120px;
        border: none;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
</style>
