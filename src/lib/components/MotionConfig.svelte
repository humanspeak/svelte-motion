<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { MotionConfigProps } from '$lib/types'
    import { createMotionConfig } from '$lib/components/motionConfig.context'

    /**
     * Provide default Motion configuration to descendants.
     *
     * Wraps content and supplies defaults such as `transition` that are merged
     * with per-element props. Descendants can retrieve config via context.
     *
     * @prop transition Default `AnimationOptions` merged with element props.
     * @prop children Slotted content receiving this configuration.
     */
    let { transition, children }: MotionConfigProps & { children?: Snippet } = $props()

    let motionConfig = $state<MotionConfigProps>({ transition })
    createMotionConfig(motionConfig)
</script>

{@render children?.()}
