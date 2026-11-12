<script lang="ts">
    import { setLazyMotionContext } from '$lib/components/lazyMotion.context'
    import {
        isLazyFeatureBundle,
        normalizeLazyFeatureBundle,
        type FeatureBundle,
        type LazyFeatureBundle
    } from '$lib/features'
    import { loadPinchFeature } from '$lib/utils/pinchFeature'
    import { untrack, type Snippet } from 'svelte'

    /**
     * Props accepted by the LazyMotion component.
     */
    type Props = {
        /** Child content rendered inside the active LazyMotion context. */
        children?: Snippet
        /** Eager or async feature bundle used by descendant `m.*` components. */
        features: FeatureBundle | LazyFeatureBundle
        /**
         * Strict LazyMotion usage checks. Defaults to false. In development,
         * rendering a `motion` component inside throws; render `m` components
         * instead (Reorder: import it from `@humanspeak/svelte-motion/m`).
         */
        strict?: boolean
    }

    let { children, features, strict = false }: Props = $props()

    // Upstream `LazyMotion` publishes no renderer until an async bundle
    // resolves (Motion 14.7.1 `components/LazyMotion/index.tsx:52-66`), so a
    // pending `m` has no VisualElement.
    let loadedFeatures = $state<FeatureBundle | undefined>(
        untrack(() => (isLazyFeatureBundle(features) ? undefined : features))
    )

    /**
     * Register a published bundle's opt-in features in motion-dom's global
     * registry (upstream `LazyMotion`'s `loadFeatures`): `pinchFeatures`
     * carries its feature class, which no other bundle registers.
     *
     * @param bundle The bundle being published to descendants.
     * @returns Nothing.
     */
    const loadBundleFeatures = (bundle: FeatureBundle): void => {
        if (bundle.pinch) loadPinchFeature(bundle.pinch)
    }

    // An eager bundle is registered during init, before any child component
    // (and so any VisualElement) is created.
    if (loadedFeatures) loadBundleFeatures(loadedFeatures)
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
            loadBundleFeatures(features)
            loadedFeatures = features
            isLoaded = true
            return
        }

        loadedFeatures = undefined
        isLoaded = false
        features()
            .then((bundle) => {
                if (currentLoadId !== loadId) return
                const loaded = normalizeLazyFeatureBundle(bundle)
                loadBundleFeatures(loaded)
                loadedFeatures = loaded
                isLoaded = true
            })
            .catch(() => {
                // A rejected loader publishes nothing, as upstream: its
                // `features().then(...)` has no `.catch`
                // (`LazyMotion/index.tsx:60`), so `m` stays featureless.
                if (currentLoadId !== loadId) return
                loadedFeatures = undefined
                isLoaded = false
            })

        return () => {
            loadId += 1
        }
    })
</script>

{@render children?.()}
