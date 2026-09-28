<script lang="ts">
    import { LayoutGroup, motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    // Port of upstream `dev/react/src/tests/layout-group-unmount.tsx`
    // (Motion v13.4.5), driven by `packages/framer-motion/cypress/integration/
    // layout-shared.ts` → "Shared layout: component unmounts in a LayoutGroup"
    // (e2e/layout/layout-group-parity/layout-group-unmount.spec.ts).
    //
    // Clicking #a unmounts it. #b (a sibling in the outer LayoutGroup) must
    // animate into the vacated space. `ease: () => 0.5` freezes #b's layout
    // animation at its midpoint so the spec can assert the in-flight bbox.

    const style = 'width: 100px; height: 100px; opacity: 1; border-radius: 20px; margin: 20px;'
    const stackStyle = 'display: flex; flex-direction: column; justify-content: start;'

    // Upstream's `Item` state: `variant === 'a'` means #a is visible.
    let variant = $state('a')

    // Tester guide (never rendered under `@isPlaywright=true`). It only
    // clicks the fixture like a user would.
    const steps: TesterStep[] = [
        {
            text: 'Click the red box (#a) to remove it.',
            expected:
                'The blue box (#b) animates up into the empty space. Because this fixture freezes the animation halfway, #b first stops at top 90 (halfway between 160 and 20) for about 0.2 s, then lands at top 20.',
            action: { run: () => document.getElementById('a')?.click() }
        },
        {
            text: 'Watch the blue box closely (use "Reset page" to repeat).',
            expected:
                'You should see it pause halfway. If it lands at top 20 instantly, it SNAPPED — the sibling never animated.'
        }
    ]
</script>

<svelte:head>
    <title>LayoutGroup · sibling unmount</title>
</svelte:head>

<LayoutGroup id="group-1">
    <motion.div style="display: contents;">
        <motion.div style={stackStyle}>
            <LayoutGroup id="group-2">
                <motion.div style="display: contents;">
                    {#if variant === 'a'}
                        <motion.div
                            id="a"
                            layoutId="a"
                            style="{style} background: red;"
                            onclick={() => (variant = variant === 'a' ? 'b' : 'a')}
                        />
                    {/if}
                </motion.div>
            </LayoutGroup>
        </motion.div>
        <motion.div
            layoutId="b"
            style="{style} background-color: blue;"
            id="b"
            transition={{ duration: 0.2, ease: () => 0.5 }}
        />
    </motion.div>
</LayoutGroup>

<TesterPanel
    eyebrow="Upstream parity · layout-shared.ts (unmount)"
    title="Removing a box moves its sibling smoothly"
    {steps}
>
    {#snippet checks()}
        <p>
            The red box (#a) is in a nested <code>LayoutGroup</code> inside a column; the blue box (#b)
            sits below it in the outer group.
        </p>
        <p>
            When #a is removed, #b's spot changes even though #b itself didn't. #b should still
            animate into the space (the whole group re-measures when any member leaves), not
            teleport.
        </p>
    {/snippet}
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
