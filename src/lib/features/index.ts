/**
 * Runtime capabilities made available to motion components inside a
 * `<LazyMotion>` subtree.
 */
export type FeatureBundle = {
    /** Enables initial/animate/exit animation behavior. */
    animations: true
    /** Enables hover, tap, focus, pan, and in-view gesture behavior. */
    gestures?: true
    /** Enables drag gesture behavior. */
    drag?: true
    /** Enables layout and shared-layout animation behavior. */
    layout?: true
}

/**
 * Function form accepted by `<LazyMotion features>`.
 *
 * The function resolves to a feature bundle directly or to a module-like
 * object with the bundle as its default export.
 */
export type LazyFeatureBundle = () => Promise<FeatureBundle | { default: FeatureBundle }>

/**
 * Returns whether a LazyMotion `features` value is an async loader.
 *
 * @param features - Feature bundle or loader passed to `<LazyMotion>`.
 * @returns True when the features value should be invoked asynchronously.
 */
export const isLazyFeatureBundle = (
    features: FeatureBundle | LazyFeatureBundle
): features is LazyFeatureBundle => typeof features === 'function'

/**
 * Normalizes an asynchronously loaded feature bundle.
 *
 * @param loaded - Resolved bundle or default-export module wrapper.
 * @returns The concrete feature bundle.
 */
export const normalizeLazyFeatureBundle = (
    loaded: FeatureBundle | { default: FeatureBundle }
): FeatureBundle => {
    if ('default' in loaded) return loaded.default
    return loaded
}
