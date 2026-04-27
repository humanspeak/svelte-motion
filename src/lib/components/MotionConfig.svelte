<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { MotionConfigProps } from '$lib/types'
    import { createMotionConfig } from '$lib/components/motionConfig.context'

    /**
     * Provide default Motion configuration to descendants.
     *
     * Wraps content and supplies defaults such as `transition` and
     * `reducedMotion` that are merged with per-element props. Descendants can
     * retrieve config via context.
     *
     * @prop transition Default `AnimationOptions` merged with element props.
     * @prop reducedMotion Reduced-motion policy: `'user' | 'always' | 'never'`.
     *   Defaults to `'never'`.
     * @prop children Slotted content receiving this configuration.
     */
    let { transition, reducedMotion, children }: MotionConfigProps & { children?: Snippet } =
        $props()

    // Use property getters so descendants always read the parent's current
    // prop values — including remounted children inside `{#key}` blocks, which
    // would otherwise see a stale snapshot if we cached the value in $state.
    const motionConfig: MotionConfigProps = {
        get transition() {
            return transition
        },
        get reducedMotion() {
            return reducedMotion
        }
    }
    createMotionConfig(motionConfig)
</script>

{@render children?.()}
