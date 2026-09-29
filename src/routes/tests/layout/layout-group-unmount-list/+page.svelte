<script lang="ts">
    import { LayoutGroup, motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'
    import Item from './Item.svelte'

    // Port of upstream `dev/react/src/tests/layout-group-unmount-list.tsx`
    // (Motion v13.4.5), driven by `packages/framer-motion/cypress/integration/
    // layout-shared.ts` → "Shared layout: component unmounts in a LayoutGroup"
    // (e2e/layout/layout-group-parity/layout-group-unmount.spec.ts).
    //
    // The list is anchored `bottom: 100px`, so removing #a shrinks the stack
    // upward and #b's position relative to its parent changes while its
    // viewport position does not. #b must stay put.
    //
    // Upstream passes `style={{ containerStyle }}` to #stack — a nested object
    // that React ignores — so #stack is intentionally unstyled here too.

    const stackStyle =
        'display: flex; flex-direction: column; justify-content: flex-start; align-items: center; padding: 20px; width: auto; height: auto; background-color: blue;'

    // Tester guide (never rendered under `@isPlaywright=true`). It only
    // clicks the fixture like a user would.
    const steps: TesterStep[] = [
        {
            text: 'Note where the yellow box (#b) is on screen.',
            expected:
                'Yellow sits below red inside the blue list, which is pinned 100 px above the bottom of the window.'
        },
        {
            text: 'Click the red box (#a) to remove it.',
            expected:
                'The blue list shrinks upward (it is pinned at the bottom). The yellow box does not move at all on screen — even though its position inside the list changed.',
            action: { run: () => document.getElementById('a')?.click() }
        }
    ]
</script>

<svelte:head>
    <title>LayoutGroup · sibling unmount in a list</title>
</svelte:head>

<LayoutGroup id="group-1">
    <motion.div style="position: absolute; left: 100px; bottom: 100px;">
        <LayoutGroup id="list">
            <motion.div style="display: contents;">
                <motion.div
                    id="stack"
                    layoutId="stack"
                    transition={{ duration: 0.2, ease: () => 0.5 }}
                >
                    <motion.div style={stackStyle}>
                        <motion.div style="display: contents;">
                            <Item id="a" backgroundColor="red" />
                            <Item id="b" backgroundColor="yellow" />
                        </motion.div>
                    </motion.div>
                </motion.div>
            </motion.div>
        </LayoutGroup>
    </motion.div>
</LayoutGroup>

<TesterPanel
    eyebrow="Upstream parity · layout-shared.ts (unmount list)"
    title="A sibling that didn't really move stays put"
    status="Passes on this build (the yellow box stays put), with LayoutGroup node groups (plan 007) and motion-dom 13.4.5 (plan 006)."
    {steps}
>
    {#snippet checks()}
        <p>
            Red and yellow boxes sit in a blue list inside nested <code>LayoutGroup</code>s. The
            list is pinned to the bottom of the window, so removing red shrinks the list upward.
        </p>
        <p>
            Yellow's position inside the list changes, but its position on screen does not. It
            should stay exactly where it is — not animate away and back.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /* Match upstream's dev harness: plain margin-less body, no centering
       sandbox. */
    :global(.container),
    :global(#sandbox) {
        display: block;
        min-height: 0;
    }
</style>
