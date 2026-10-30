<script lang="ts">
    import { LazyMotion, domMax, m, useMotionValue, type LazyFeatureBundle } from '$lib'

    type Props = {
        /** Where the `m.div`s render: bare, in a sync LazyMotion, or in an async one. */
        wrap: 'none' | 'sync' | 'async'
        /** Async feature loader used when `wrap` is `'async'`. */
        loader?: LazyFeatureBundle
        /** A raw (non-forced) style value rendered next to the MotionValue. */
        width?: string
        /** A raw value for the forced transform key `x` on the second box. */
        rawX?: number
    }

    let { wrap, loader, width = '10px', rawX = 10 }: Props = $props()

    const x = useMotionValue(0)
    /** Sets the box's style MotionValue `x`. */
    export const setX = (value: number) => x.set(value)
    /** Reads the box's style MotionValue `x`. */
    export const getX = () => x.get()

    const willChange = useMotionValue('auto')
    /** Sets the third box's `willChange` MotionValue. */
    export const setWillChange = (value: string) => willChange.set(value)
    /** Reads the third box's `willChange` MotionValue. */
    export const getWillChange = () => willChange.get()
</script>

{#snippet boxes()}
    <m.div data-testid="box" style={{ x, width }} />
    <m.div data-testid="forced" style={{ x: rawX }} />
    <m.div data-testid="will-change" style={{ willChange }} />
{/snippet}

{#if wrap === 'none'}
    {@render boxes()}
{:else if wrap === 'sync'}
    <LazyMotion features={domMax}>
        {@render boxes()}
    </LazyMotion>
{:else if loader}
    <LazyMotion features={loader}>
        {@render boxes()}
    </LazyMotion>
{/if}
