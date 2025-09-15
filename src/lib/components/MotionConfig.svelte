<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { MotionConfigProps } from '$lib/types.js'
    import { createMotionConfig } from './motionConfig.context.js'

    let { transition, children }: MotionConfigProps & { children?: Snippet } = $props()

    let motionConfig = $state<MotionConfigProps>({ transition })
    createMotionConfig(motionConfig)
</script>

{@render children?.()}
