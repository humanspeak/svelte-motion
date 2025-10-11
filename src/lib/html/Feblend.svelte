<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLElementProps } from '$lib/types'

    let { children, ref = $bindable(null), ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer bind:ref tag="feblend" {...rest}>
    {@render children?.()}
</MotionContainer>