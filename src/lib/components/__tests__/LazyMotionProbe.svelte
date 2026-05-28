<script lang="ts">
    import { LazyMotion, m, type FeatureBundle, type LazyFeatureBundle } from '$lib'

    type Props = {
        features: FeatureBundle | LazyFeatureBundle
    }

    let { features }: Props = $props()
</script>

<LazyMotion {features}>
    <m.div data-testid="box" animate={{ opacity: 1 }} initial={{ opacity: 0 }}>Box</m.div>
    <m.div data-testid="tap" whileTap={{ scale: 0.9 }}>Tap</m.div>
</LazyMotion>
