<script lang="ts">
    import { LayoutGroup, motion } from '$lib'
    import JumpMeter from '../_parity/JumpMeter.svelte'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    // Real-layout port of the Jest fixture in upstream
    // `packages/framer-motion/src/components/LayoutGroup/__tests__/
    // relative-child-measurements.test.tsx` (Motion v13.4.5), driven by
    // e2e/layout/layout-group-parity/relative-child-measurements.spec.ts.
    //
    // #parent shares a LayoutGroup with #expander, so toggling #expander
    // re-measures #parent. Each child is in its own LayoutGroup inherit="id",
    // so it isn't re-measured with #parent and must follow it via its relative
    // target.
    //
    // Boxes match the Jest mock: #expander 100×25 (100×100 expanded) at 0,0;
    // #parent 400×40 at top 35 (110 expanded); child{i} 50×30 at
    // top parentTop + 5, left 50 + 20i (+100 when shifted).
    //
    // Query params: `children=N` (default 1), `childTransition=long|short`.

    let { data }: { data: { childCount: number; childTransition: 'long' | 'short' } } = $props()

    const long = { layout: { type: 'tween' as const, ease: 'linear' as const, duration: 10 } }
    const short = { layout: { type: 'tween' as const, ease: 'linear' as const, duration: 0.05 } }

    // svelte-ignore state_referenced_locally
    const childCount = data.childCount
    // svelte-ignore state_referenced_locally
    const childTransition = data.childTransition === 'short' ? short : long

    let expanded = $state(false)
    let shifts = $state<boolean[]>(Array.from({ length: childCount }, () => false))

    // Tester guide (never rendered under `@isPlaywright=true`). It only
    // clicks the fixture's own toggle buttons like a user would.
    const click = (id: string) => () => document.getElementById(id)?.click()
    const steps: TesterStep[] = [
        {
            text: 'Click "toggle expander" (bottom-left).',
            expected:
                'The red bar grows and the grey parent strip slides down 75 px over 10 seconds. The blue child rides along: "Offset from row" stays at 5 px.',
            action: { run: click('toggle-expander') }
        },
        {
            text: 'Click "toggle child0" to start the child\'s own 10-second slide to the right.',
            expected: 'The blue child starts sliding right inside the strip.',
            action: { run: click('toggle-child0') }
        },
        {
            text: 'While the child is still sliding, click "toggle expander" again.',
            expected:
                'The strip moves back up; the child keeps sliding and never jumps — its offset from the strip holds (±1 px).',
            action: { run: click('toggle-expander') }
        },
        {
            text: 'Optional: add ?children=10 to the URL, toggle every child, then toggle the expander a few times.',
            expected: 'All ten children follow the strip without jumping.'
        }
    ]
</script>

<svelte:head>
    <title>LayoutGroup · relative children re-layout</title>
</svelte:head>

<div class="fixture">
    <LayoutGroup>
        <motion.div
            id="expander"
            layout
            transition={long}
            data-expanded={expanded}
            style="width: 100px; height: {expanded ? 100 : 25}px; background: red;"
        />
        <motion.div
            id="parent"
            layout
            transition={long}
            style="position: relative; margin-top: 10px; width: 400px; height: 40px; background: #ddd;"
        >
            {#each shifts as shift, i (i)}
                <LayoutGroup inherit="id">
                    <motion.div
                        id="child{i}"
                        layout
                        transition={childTransition}
                        data-shift={shift}
                        style="position: absolute; top: 5px; left: {50 +
                            20 * i}px; margin-left: {shift
                            ? 100
                            : 0}px; width: 50px; height: 30px; background: blue; opacity: 0.6;"
                    />
                </LayoutGroup>
            {/each}
        </motion.div>
    </LayoutGroup>
</div>

<div class="controls">
    <button id="toggle-expander" type="button" onclick={() => (expanded = !expanded)}>
        toggle expander
    </button>
    {#each shifts.keys() as i (i)}
        <button id="toggle-child{i}" type="button" onclick={() => (shifts[i] = !shifts[i])}>
            toggle child{i}
        </button>
    {/each}
</div>

<TesterPanel
    eyebrow="Upstream parity · relative-child-measurements.test.tsx"
    title="Children follow a re-laid-out parent"
    {steps}
>
    {#snippet checks()}
        <p>
            The grey strip (#parent) shares a <code>LayoutGroup</code> with the red bar, so it
            animates when the bar grows. Each blue child is in its own nested group (<code
                >inherit="id"</code
            >, tracked separately from the strip).
        </p>
        <p>
            When the strip moves, each child should follow it smoothly while finishing its own
            slide. The e2e spec also counts how often each element's position is measured (not
            visible here): upstream only re-measures children that are mid-animation, once per strip
            move.
        </p>
    {/snippet}
    <JumpMeter targetId="child0" parentId="parent" emphasizeOffset />
</TesterPanel>

<style>
    /* Boxes are positioned from the top-left of a margin-less body, like the
       Jest fixture's mocked rects — not inside the sandbox's centering
       flexbox. */
    :global(.container),
    :global(#sandbox) {
        display: block;
        min-height: 0;
    }

    .fixture {
        position: absolute;
        top: 0;
        left: 0;
    }

    .controls {
        position: fixed;
        bottom: 0;
        left: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 12px;
    }
</style>
