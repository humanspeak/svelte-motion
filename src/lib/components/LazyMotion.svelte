<script lang="ts">
    import { setLazyMotionContext } from '$lib/components/lazyMotion.context'
    import { domMin } from '$lib/features/domMin'
    import {
        isLazyFeatureBundle,
        normalizeLazyFeatureBundle,
        type FeatureBundle,
        type LazyFeatureBundle
    } from '$lib/features'
    import { onMount, untrack, type Snippet } from 'svelte'

    type Props = {
        children?: Snippet
        features: FeatureBundle | LazyFeatureBundle
        strict?: boolean
    }

    let { children, features, strict = false }: Props = $props()

    let loadedFeatures = $state<FeatureBundle>(
        untrack(() => (isLazyFeatureBundle(features) ? domMin : features))
    )
    let isLoaded = $state(untrack(() => !isLazyFeatureBundle(features)))

    setLazyMotionContext({
        getFeatures: () => loadedFeatures,
        getIsLoaded: () => isLoaded,
        get strict() {
            return strict
        }
    })

    $effect(() => {
        if (!isLazyFeatureBundle(features)) {
            loadedFeatures = features
            isLoaded = true
        }
    })

    onMount(() => {
        if (!isLazyFeatureBundle(features)) return

        let cancelled = false
        features().then((bundle) => {
            if (cancelled) return
            loadedFeatures = normalizeLazyFeatureBundle(bundle)
            isLoaded = true
        })

        return () => {
            cancelled = true
        }
    })
</script>

{@render children?.()}
