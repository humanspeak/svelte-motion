<script lang="ts">
    import type { Snippet } from 'svelte'
    import { resolveTransition } from 'motion-dom'
    import type { MotionConfigProps, MotionTransition } from '$lib/types'
    import { createMotionConfig, getMotionConfig } from '$lib/components/motionConfig.context'

    /**
     * Provide default Motion configuration to descendants.
     *
     * Wraps content and supplies defaults such as `transition`,
     * `reducedMotion` and `skipAnimations` that are merged with per-element
     * props. Descendants can retrieve config via context.
     *
     * @prop transition Default `AnimationOptions` merged with element props.
     * @prop reducedMotion Reduced-motion policy: `'user' | 'always' | 'never'`.
     *   Defaults to `'never'`.
     * @prop skipAnimations When `true`, descendant animations jump to their
     *   final value instead of tweening. Defaults to `false`.
     * @prop children Slotted content receiving this configuration.
     */
    let {
        transition,
        reducedMotion,
        skipAnimations,
        children
    }: MotionConfigProps & { children?: Snippet } = $props()

    // Read the ancestor config BEFORE `createMotionConfig` shadows the context
    // key for this subtree. Upstream merges the parent context into its own
    // (`config = { ...parentConfig, ...config }`, framer-motion
    // components/MotionConfig/index.tsx:35), so a nested config that sets only
    // `transition` still inherits the outer `reducedMotion`/`skipAnimations`.
    // Without this, a nested <MotionConfig> silently re-enables animations
    // inside a skipAnimations subtree.
    const parentConfig = getMotionConfig()

    // Use property getters so descendants always read the parent's current
    // prop values — including remounted children inside `{#key}` blocks, which
    // would otherwise see a stale snapshot if we cached the value in $state.
    // The `??` fallbacks stay inside the getters so inheritance is re-resolved
    // on every read rather than frozen at init.
    const motionConfig: MotionConfigProps = {
        get transition() {
            // Upstream: `config.transition = resolveTransition(config.transition,
            // parentConfig.transition)` (framer-motion
            // components/MotionConfig/index.tsx:36-39). `resolveTransition`
            // shallow-merges ONLY when the child sets `inherit: true`; otherwise
            // the child's object replaces the parent's wholesale. The `??` then
            // covers the bare-config case, where there is no own transition at all.
            return (
                (resolveTransition(transition, parentConfig?.transition) as MotionTransition) ??
                parentConfig?.transition
            )
        },
        get reducedMotion() {
            return reducedMotion ?? parentConfig?.reducedMotion
        },
        get skipAnimations() {
            return skipAnimations ?? parentConfig?.skipAnimations
        }
    }
    createMotionConfig(motionConfig)
</script>

{@render children?.()}
