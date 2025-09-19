<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLVoidElementProps } from '$lib/types.js'

    let { ...rest }: HTMLVoidElementProps = $props()
</script>

<MotionContainer tag="col" {...rest} />
