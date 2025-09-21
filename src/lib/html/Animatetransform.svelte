<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLElementProps } from '$lib/types'

    let { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="animatetransform" {...rest}>
    {@render children?.()}
</MotionContainer>
