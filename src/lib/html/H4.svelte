<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { HTMLElementProps } from '../types.js'

    let { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="h4" {...rest}>
    {@render children?.()}
</MotionContainer>
