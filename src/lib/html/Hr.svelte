<script lang="ts">
    import MotionContainer from './_MotionContainer.svelte'
    import type { HTMLVoidElementProps } from '../types.js'

    let { ...rest } = $props<HTMLVoidElementProps>()
</script>

<MotionContainer tag="hr" {...rest} />
