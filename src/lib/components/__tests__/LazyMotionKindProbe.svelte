<script lang="ts">
    import { LazyMotion, m, motion, type FeatureBundle, type LazyFeatureBundle } from '$lib'

    type Props = {
        features: FeatureBundle | LazyFeatureBundle
        strict?: boolean
        include?: 'motion' | 'm' | 'both'
    }

    let { features, strict = false, include = 'both' }: Props = $props()
</script>

<LazyMotion {features} {strict}>
    {#if include !== 'm'}
        <motion.div data-testid="motion-tap" whileTap={{ scale: 0.9 }}>motion</motion.div>
    {/if}
    {#if include !== 'motion'}
        <m.div data-testid="m-tap" whileTap={{ scale: 0.9 }}>m</m.div>
    {/if}
</LazyMotion>
