<script lang="ts">
    import { setLazyMotionContext } from '$lib/components/lazyMotion.context'
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

        loadedFeatures = undefined
        isLoaded = false
        features()
            .then((bundle) => {
                if (currentLoadId !== loadId) return
                loadedFeatures = normalizeLazyFeatureBundle(bundle)
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
