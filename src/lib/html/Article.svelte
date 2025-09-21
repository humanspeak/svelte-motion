<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLElementProps } from '$lib/types'

    let { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="article" {...rest}>
    {@render children?.()}
</MotionContainer>
