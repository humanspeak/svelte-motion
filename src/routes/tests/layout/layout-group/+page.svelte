<script lang="ts">
    import { LayoutGroup, MotionConfig, motion } from '$lib'
    import JumpMeter from '../_parity/JumpMeter.svelte'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'
    import Button from './Button.svelte'
    import Expander from './Expander.svelte'

    // Port of upstream `dev/react/src/tests/layout-group.tsx` (Motion v13.4.5),
    // driven by `packages/framer-motion/cypress/integration/layout-group.ts`
    // (e2e/layout/layout-group-parity/layout-group.spec.ts).
    //
    // #button lives in its own `<LayoutGroup inherit="id">` inside the
    // `layout="position"` #text-wrapper. Toggling #expander re-lays out
    // #text-wrapper; #button must follow it smoothly rather than jumping.

    let visible = $state(false)

    const transition = {
        layout: {
            type: 'tween' as const,
            duration: 1
        }
    }

    // Tester guide (never rendered under `@isPlaywright=true`). Everything
    // below only reads the fixture or clicks it like a user would.
    const click = (id: string) => () => document.getElementById(id)?.click()
    const expectedTop = () => {
        const expanded = document.getElementById('expander')?.textContent?.includes('collapse')
        return 39 + (expanded ? 75 : 0) + (visible ? 110 : 0)
    }
    const steps: TesterStep[] = [
        {
            text: 'Click the red "expand me" bar.',
            expected:
                'The bar grows; the blue "Add child" button glides down with its row over about 1 second (settles at top 114). GLIDED in the readout.',
            action: { run: click('expander') }
        },
        {
            text: 'Click the red bar again.',
            expected: 'The button glides back up to top 39.',
            action: { run: click('expander') }
        },
        {
            text: 'Click the blue "Add child" button.',
            expected:
                'A green box appears at the top; the button glides down to top 149 (its own layout animation).',
            action: { run: click('button') }
        },
        {
            text: 'With the green box showing, click the red bar.',
            expected: 'The button glides from 149 to 224, again without teleporting.',
            action: { run: click('expander') }
        },
        {
            text: 'Reload, click the red bar, then click it again while the button is still moving.',
            expected: 'The button reverses mid-way and glides back to top 39.'
        }
    ]
</script>

<svelte:head>
    <title>LayoutGroup · inherit="id" relative children</title>
</svelte:head>

<div style="display: flex; justify-content: center; height: 100vh;">
    <div
        style="display: flex; flex-direction: column; gap: 10px; align-items: center; height: 100vh; width: 500px;"
    >
        {#if visible}
            <div style="background-color: green; width: 100px; height: 100px;"></div>
        {/if}
        <LayoutGroup>
            <MotionConfig {transition}>
                <motion.div id="expander-wrapper" layout="position">
                    <Expander />
                </motion.div>
                <motion.div
                    id="text-wrapper"
                    layout="position"
                    style="display: flex; gap: 4px; align-items: center;"
                >
                    some text
                    <LayoutGroup inherit="id">
                        <Button onclick={() => (visible = !visible)} />
                    </LayoutGroup>
                </motion.div>
            </MotionConfig>
        </LayoutGroup>
    </div>
</div>

<TesterPanel
    eyebrow="Upstream parity · layout-group.ts"
    title="Buttons glide with their row"
    {steps}
>
    {#snippet checks()}
        <p>
            The blue "Add child" button sits in its own <code>LayoutGroup inherit="id"</code> (a nested
            group that shares the outer group's name but is tracked separately) inside the text row.
        </p>
        <p>
            When the red bar grows or shrinks, the row moves. The button should glide with its row
            over about 1 second, never teleport to its new spot.
        </p>
    {/snippet}
    <JumpMeter targetId="button" parentId="text-wrapper" {expectedTop} />
</TesterPanel>

<style>
    /* Match upstream's dev harness: the fixture renders at the top-left of
       a margin-less body, not inside the sandbox's centering flexbox. */
    :global(.container),
    :global(#sandbox) {
        display: block;
        min-height: 0;
    }
</style>
