<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLElementProps } from '$lib/types'
    import { isMotionValueChild } from '$lib/utils/motionValueChild'

    let { children, ref = $bindable(null), ...rest }: HTMLElementProps = $props()
    const motionValueChild = $derived(isMotionValueChild(children) ? children : undefined)
    const childSnippet = $derived(typeof children === 'function' ? children : undefined)
</script>

<MotionContainer bind:ref tag="a" {motionValueChild} {...rest}>
    {@render childSnippet?.()}
</MotionContainer>
