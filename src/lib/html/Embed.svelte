<script lang="ts">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLVoidElementProps } from '$lib/types'

    let { ref = $bindable(), ...rest }: HTMLVoidElementProps = $props()
</script>

<MotionContainer bind:ref tag="embed" {...rest} />
