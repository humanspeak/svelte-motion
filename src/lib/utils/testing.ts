/**
 * Return a promise that resolves after the given number of milliseconds.
 *
 * @param ms Delay in milliseconds.
 * @returns A promise that resolves after the delay.
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
