<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLVoidElementProps } from '$lib/types.js'

    const { ...rest }: HTMLVoidElementProps = $props()
</script>

<MotionContainer tag="input" {...rest} />
