<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { HTMLElementProps } from '../types.js'

    type Props = HTMLElementProps

    let { children, ...rest } = $props<HTMLElementProps>()
</script>

<MotionContainer tag="thead" {...rest}>
    {@render children?.()}
</MotionContainer>
