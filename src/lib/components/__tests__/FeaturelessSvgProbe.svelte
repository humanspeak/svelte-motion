<script lang="ts">
    import { LazyMotion, domMax, m, type LazyFeatureBundle } from '$lib'

    type Props = {
        /** Where the `m.path` renders: bare, in a sync LazyMotion, or in an async one. */
        wrap: 'none' | 'sync' | 'async'
        /** Async feature loader used when `wrap` is `'async'`. */
        loader?: LazyFeatureBundle
    }

    let { wrap, loader }: Props = $props()
</script>

{#snippet path()}
    <svg width="100" height="10">
        <m.path
            data-testid="path"
            d="M0 0 L100 0"
            initial={{ pathLength: 0.2 }}
            animate={{ pathLength: 1 }}
        />
    </svg>
{/snippet}

{#if wrap === 'none'}
    {@render path()}
{:else if wrap === 'sync'}
    <LazyMotion features={domMax}>
        {@render path()}
    </LazyMotion>
{:else if loader}
    <LazyMotion features={loader}>
        {@render path()}
    </LazyMotion>
{/if}
