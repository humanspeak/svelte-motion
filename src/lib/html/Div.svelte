<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { Snippet } from 'svelte'

    type Props = {
        children?: Snippet
        [key: string]: unknown
    }

    let { children, ...rest }: Props = $props()
</script>

<MotionContainer tag="div" {...rest}>
    {@render children?.()}
</MotionContainer>
