<script lang="ts">
    import { setLazyMotionContext } from '$lib/components/lazyMotion.context'
    import { domMin } from '$lib/features/domMin'
    import {
        isLazyFeatureBundle,
        normalizeLazyFeatureBundle,
        type FeatureBundle,
        type LazyFeatureBundle
    } from '$lib/features'
    import { untrack, type Snippet } from 'svelte'

    /**
     * Props accepted by the LazyMotion component.
     */
    type Props = {
        /** Child content rendered inside the active LazyMotion context. */
        children?: Snippet
        /** Eager or async feature bundle used by descendant `m.*` components. */
        features: FeatureBundle | LazyFeatureBundle
        /** Enables strict LazyMotion usage checks. Defaults to false. */
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

    let loadId = 0

    $effect(() => {
        const currentLoadId = ++loadId

        if (!isLazyFeatureBundle(features)) {
            loadedFeatures = features
            isLoaded = true
            return
        }

        loadedFeatures = domMin
        isLoaded = false
        features()
            .then((bundle) => {
                if (currentLoadId !== loadId) return
                loadedFeatures = normalizeLazyFeatureBundle(bundle)
                isLoaded = true
            })
            .catch(() => {
                if (currentLoadId !== loadId) return
                loadedFeatures = domMin
                isLoaded = false
            })

        return () => {
            loadId += 1
        }
    })
</script>

{@render children?.()}
