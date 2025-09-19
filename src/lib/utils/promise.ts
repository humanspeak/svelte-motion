/**
 * Returns true if the provided value appears to be Promise-like.
 *
 * A value is considered Promise-like if it is a non-null object that exposes a
 * callable `then` function. This conservative check avoids throwing on
 * primitives and is resilient to different Promise implementations.
 *
 * @param value Value to test.
 * @return Whether `value` is Promise-like.
 */
export const isPromiseLike = (value: unknown): value is Promise<unknown> => {
    return (
        typeof value === 'object' &&
        value !== null &&
        'then' in (value as { then?: unknown }) &&
        typeof (value as { then?: unknown }).then === 'function'
    )
}

/** Structure with an optional `finished` field compatible with Motion controls. */
export type WithFinished = { finished?: unknown }

/**
 * Narrows to objects that expose a `finished` Promise.
 *
 * Motion's `animate` may return an object with a `finished` Promise, or a
 * then-able control. This helper provides a safe type-guard for the former.
 *
 * @typeParam T Input object type.
 * @param value Value to inspect.
 * @return Whether `value.finished` is a Promise.
 */
export const hasFinishedPromise = <T extends WithFinished>(
    value: T
): value is T & { finished: Promise<unknown> } => {
    return (
        typeof value === 'object' &&
        value !== null &&
        'finished' in (value as { finished?: unknown }) &&
        isPromiseLike((value as { finished?: unknown }).finished)
    )
}
