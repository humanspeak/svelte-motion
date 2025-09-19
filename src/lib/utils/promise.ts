export function isPromiseLike(value: unknown): value is Promise<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'then' in (value as { then?: unknown }) &&
        typeof (value as { then?: unknown }).then === 'function'
    )
}

export type WithFinished = { finished?: unknown }

export function hasFinishedPromise<T extends WithFinished>(
    value: T
): value is T & {
    finished: Promise<unknown>
} {
    return (
        typeof value === 'object' &&
        value !== null &&
        'finished' in (value as { finished?: unknown }) &&
        isPromiseLike((value as { finished?: unknown }).finished)
    )
}
