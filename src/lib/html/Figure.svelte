<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { HTMLElementProps } from '../types.js'

    let { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="figure" {...rest}>
    {@render children?.()}
</MotionContainer>
