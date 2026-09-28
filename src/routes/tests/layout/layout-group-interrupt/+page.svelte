<script lang="ts">
    import { LayoutGroup, MotionConfig, motion } from '$lib'
    import JumpMeter from '../_parity/JumpMeter.svelte'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    // Port of upstream `dev/react/src/tests/layout-group-interrupt.tsx`
    // (Motion v13.4.5), driven by
    // `packages/framer-motion/cypress/integration/layout-group-interrupt.ts` and
    // `layout-group-interrupt-measurements.ts`
    // (e2e/layout/layout-group-parity/layout-group-interrupt*.spec.ts).
    //
    // #button is in its own LayoutGroup, so toggling #expander re-measures
    // #text-wrapper but not #button, which must follow its parent via its
    // relative target. Clicking #button also moves it right within
    // #text-wrapper, so its own animation has a relative component.

    const transition = {
        layout: { type: 'tween' as const, ease: 'linear' as const, duration: 10 }
    }

    let visible = $state(false)
    let expanded = $state(false)

    const expanderId = $props.id()
    const buttonId = `${expanderId}-button`

    // Tester guide (never rendered under `@isPlaywright=true`). Everything
    // below only reads the fixture or clicks it like a user would.
    const click = (id: string) => () => document.getElementById(id)?.click()
    const steps: TesterStep[] = [
        {
            text: 'Click the blue "Add child" button.',
            expected:
                'A green box appears; the button starts a slow 10-second slide down (and a little right, because the text gets longer).',
            action: { run: click('button') }
        },
        {
            text: 'Wait 2–4 seconds, until the button is partway through its move.',
            expected: 'The button is still sliding. "Offset from row" stays at its starting value.'
        },
        {
            text: 'Now click the red bar (this interrupts the slide by moving the whole row).',
            expected:
                'The button keeps sliding smoothly, no jump. "Offset from row" stays holding (±1 px). The history shows GLIDED.',
            action: { label: 'Click the red bar', run: click('expander') }
        },
        {
            text: 'Click the red bar again after half a second.',
            expected: 'Same: no jump, and the offset from the row still holds.',
            action: { label: 'Click the red bar', run: click('expander') }
        }
    ]
</script>

<svelte:head>
    <title>LayoutGroup · interrupted relative child</title>
</svelte:head>

<div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
    {#if visible}
        <div style="background: green; width: 100px; height: 100px;"></div>
    {/if}
    <LayoutGroup>
        <MotionConfig {transition}>
            <motion.div layout="position">
                <motion.div
                    id="expander"
                    layoutId={expanderId}
                    onclick={() => (expanded = !expanded)}
                    style="width: 100px; height: {expanded ? 100 : 25}px; background: red;"
                />
            </motion.div>
            <motion.div id="text-wrapper" layout="position" style="display: flex; gap: 4px;">
                {visible ? 'some longer text' : 'some text'}
                <LayoutGroup inherit="id">
                    <motion.div
                        id="button"
                        layoutId={buttonId}
                        onclick={() => (visible = !visible)}
                        style="background: blue; padding: 10px;"
                    >
                        Add child
                    </motion.div>
                </LayoutGroup>
            </motion.div>
        </MotionConfig>
    </LayoutGroup>
</div>

<TesterPanel
    eyebrow="Upstream parity · layout-group-interrupt.ts"
    title="Interrupted slide keeps its place in the row"
    {steps}
>
    {#snippet checks()}
        <p>
            The blue button lives in its own <code>LayoutGroup inherit="id"</code> (a nested group tracked
            separately from its row). Clicking it starts a slow 10-second slide.
        </p>
        <p>
            If the red bar is clicked mid-slide, the whole row moves. The button must follow its row
            without jumping and without skipping the rest of its own slide: its offset from the row
            (the invariant) should stay within 1 px of where it started.
        </p>
    {/snippet}
    <JumpMeter targetId="button" parentId="text-wrapper" emphasizeOffset />
</TesterPanel>

<style>
    /* Match upstream's dev harness: the fixture renders at the top of a
       margin-less body, not inside the sandbox's centering flexbox. */
    :global(.container),
    :global(#sandbox) {
        display: block;
        min-height: 0;
    }
</style>
