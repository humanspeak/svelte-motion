<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLVoidElementProps } from '$lib/types'

    let { ...rest }: HTMLVoidElementProps = $props()
</script>

<MotionContainer tag="track" {...rest} />
