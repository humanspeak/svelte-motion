<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import { motion } from '$lib/motion'

    /**
     * Test harness reproducing the idiomatic Svelte 5 ref pattern from #417:
     * a freshly-declared `$state()` (initially `undefined`) bound via
     * `bind:ref`. This exercises a regular element (`motion.div`), a void
     * element (`motion.source`), and `_MotionContainer` directly — the three
     * surfaces called out in the issue. Before the fix these threw
     * `props_invalid_value` at mount because `ref` defaulted to `$bindable(null)`.
     *
     * `show` toggles the bound elements so the teardown side of the contract
     * (refs reset when the element unmounts) can be asserted too.
     */
    let {
        show = true,
        onRefs
    }: {
        show?: boolean
        onRefs?: (refs: {
            div?: HTMLElement | null
            source?: HTMLElement | null
            container?: HTMLElement | null
        }) => void
    } = $props()

    // Idiomatic refs: `$state()` is `undefined` until the element mounts.
    let divEl = $state<HTMLDivElement>()
    let sourceEl = $state<HTMLSourceElement>()
    let containerEl = $state<HTMLElement>()

    $effect(() => {
        onRefs?.({ div: divEl, source: sourceEl, container: containerEl })
    })
</script>

{#if show}
    <motion.div bind:ref={divEl}>hi</motion.div>
    <motion.source bind:ref={sourceEl} />
    <MotionContainer bind:ref={containerEl} tag="span">hi</MotionContainer>
{/if}
