<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLElementProps } from '$lib/types.js'

    const { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="address" {...rest}>
    {@render children?.()}
</MotionContainer>
