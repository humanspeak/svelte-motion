<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { HTMLElementProps } from '../types.js'

    let { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="header" {...rest}>
    {@render children?.()}
</MotionContainer>
