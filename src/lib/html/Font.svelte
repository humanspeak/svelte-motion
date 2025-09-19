<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLElementProps } from '$lib/types.js'

    let { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="font" {...rest}>
    {@render children?.()}
</MotionContainer>
