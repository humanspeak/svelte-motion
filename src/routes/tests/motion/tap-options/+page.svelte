<script lang="ts">
    import { motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Motion 14.10 `tap` prop: one tap gesture becomes a double tap
    // (`count`), a long press (`hold`) or an auto-repeating stepper
    // (`repeat`). Upstream `framer-motion/src/gestures/press.ts` and
    // `__tests__/press-options.test.tsx` at v14.10.1.

    let doubleTap = $state(0)
    let doubleCancel = $state(0)
    let longTap = $state(0)
    let longCancel = $state(0)
    let stepperValue = $state(0)

    const steps: TesterStep[] = [
        {
            text: 'Click "Double" once, wait a second, then double-click it quickly.',
            expected: 'One click does nothing; a quick double click counts 1.'
        },
        {
            text: 'Click "Long" briefly, then press and hold it for about a second.',
            expected: 'A short click counts a cancel; holding half a second counts 1.'
        },
        {
            text: 'Press and hold "Stepper" for two seconds.',
            expected:
                'Holding increases the value about 10 per second and the button stays pressed (scaled).'
        }
    ]
</script>

<svelte:head>
    <title>Tap options: count, hold and repeat</title>
</svelte:head>

<main class="tap-options">
    <section>
        <motion.button
            data-testid="double"
            class="target"
            style="background-color: #e11d48;"
            whileTap={{ scale: 0.9 }}
            tap={{ count: 2 }}
            onTap={() => doubleTap++}
            onTapCancel={() => doubleCancel++}
        >
            Double
        </motion.button>
        <p>
            tap: <strong data-testid="double-tap">{doubleTap}</strong> · cancel:
            <strong data-testid="double-cancel">{doubleCancel}</strong>
        </p>
    </section>

    <section>
        <motion.button
            data-testid="long"
            class="target"
            style="background-color: #7c3aed;"
            whileTap={{ scale: 0.9 }}
            tap={{ hold: 0.5 }}
            onTap={() => longTap++}
            onTapCancel={() => longCancel++}
        >
            Long
        </motion.button>
        <p>
            tap: <strong data-testid="long-tap">{longTap}</strong> · cancel:
            <strong data-testid="long-cancel">{longCancel}</strong>
        </p>
    </section>

    <section>
        <motion.button
            data-testid="stepper"
            class="target"
            style="background-color: #22aa66;"
            whileTap={{ scale: 0.9 }}
            tap={{ repeat: 0.1 }}
            onTap={() => stepperValue++}
        >
            Stepper
        </motion.button>
        <p>value: <strong data-testid="stepper-value">{stepperValue}</strong></p>
    </section>
</main>

<TesterPanel eyebrow="press-options.test.tsx" title="Tap options: count, hold and repeat" {steps}>
    {#snippet checks()}
        <p>
            <code>tap</code> turns one tap gesture into a double tap, a long press or a stepper.
            <code>whileTap</code> starts on the first press and stays on while a repeat fires.
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
        width: 120px;
        height: 120px;
        border: none;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
</style>
