<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { HTMLElementProps } from '../types.js'

    let { children, ...rest }: HTMLElementProps = $props()
</script>

<MotionContainer tag="label" {...rest}>
    {@render children?.()}
</MotionContainer>
