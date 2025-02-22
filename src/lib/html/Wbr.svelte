<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { HTMLVoidElementProps } from '../types.js'

    let { ...rest }: HTMLVoidElementProps = $props()
</script>

<MotionContainer tag="wbr" {...rest} />
