<script lang="ts">
    import { LazyMotion, m, motion, type FeatureBundle } from '$lib'
    import type { MotionProps } from '$lib/types'

    /**
     * One pinchable `data-testid="box"` element, rendered as `motion.div` or
     * `m.div`, inside a `<LazyMotion>` when `features` is set and without
     * one otherwise. Ports the components upstream's `pinch.test.tsx` renders.
     */
    type Props = {
        /** Which component kind to render. */
        kind?: 'motion' | 'm'
        /** The LazyMotion bundle; without one, no LazyMotion wraps the box. */
        features?: FeatureBundle
        /** `<LazyMotion strict>`. */
        strict?: boolean
        /** Renders the box; false unmounts it (LazyMotion stays). */
        show?: boolean
        pinch?: MotionProps['pinch']
        whilePinch?: MotionProps['whilePinch']
        variants?: MotionProps['variants']
        transition?: MotionProps['transition']
        drag?: MotionProps['drag']
        style?: MotionProps['style']
        /** Renders an `m.div` child with these props when set. */
        child?: {
            variants?: MotionProps['variants']
            transition?: MotionProps['transition']
            style?: MotionProps['style']
        }
    }

    let {
        kind = 'm',
        features,
        strict = false,
        show = true,
        pinch,
        whilePinch,
        variants,
        transition,
        drag,
        style,
        child
    }: Props = $props()
</script>

{#snippet box()}
    {#if show}
        {#if kind === 'm'}
            <m.div data-testid="box" {pinch} {whilePinch} {variants} {transition} {drag} {style}>
                {#if child}
                    <m.div
                        data-testid="child"
                        variants={child.variants}
                        transition={child.transition}
                        style={child.style}
                    />
                {/if}
            </m.div>
        {:else}
            <motion.div
                data-testid="box"
                {pinch}
                {whilePinch}
                {variants}
                {transition}
                {drag}
                {style}
            >
                {#if child}
                    <m.div
                        data-testid="child"
                        variants={child.variants}
                        transition={child.transition}
                        style={child.style}
                    />
                {/if}
            </motion.div>
        {/if}
    {/if}
{/snippet}

{#if features}
    <LazyMotion {features} {strict}>
        {@render box()}
    </LazyMotion>
{:else}
    {@render box()}
{/if}
