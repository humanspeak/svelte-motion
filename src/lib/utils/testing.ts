/**
 * Return a promise that resolves after the given number of milliseconds.
 *
 * @param ms Delay in milliseconds.
 * @returns A promise that resolves after the delay.
 *
 * @example
 * ```ts
 * await sleep(100) // pause for 100 ms
 * ```
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
