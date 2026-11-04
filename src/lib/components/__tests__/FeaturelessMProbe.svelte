<script lang="ts">
    import { LazyMotion, domMax, m, type LazyFeatureBundle } from '$lib'

    type Props = {
        /** Where the `m.div` renders: bare, in a sync LazyMotion, or in an async one. */
        wrap: 'none' | 'sync' | 'async'
        /** Async feature loader used when `wrap` is `'async'`. */
        loader?: LazyFeatureBundle
        /** Renders an inner `m.div` that inherits the box's variants. */
        withChild?: boolean
    }

    let { wrap, loader, withChild = false }: Props = $props()
</script>

{#snippet box()}
    <m.div
        data-testid="box"
        style="width: 10px"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileTap={{ scale: 0.9 }}
        drag="x"
        variants={{ on: { opacity: 1 } }}
    >
        {#if withChild}
            <m.div data-testid="child" variants={{ on: { x: 10 } }} />
        {/if}
    </m.div>
{/snippet}

{#if wrap === 'none'}
    {@render box()}
{:else if wrap === 'sync'}
    <LazyMotion features={domMax}>
        {@render box()}
    </LazyMotion>
{:else if loader}
    <LazyMotion features={loader}>
        {@render box()}
    </LazyMotion>
{/if}
