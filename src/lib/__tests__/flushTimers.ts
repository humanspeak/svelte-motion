import { tick } from 'svelte'
import { vi } from 'vitest'

/**
 * Drains the async work that motion components schedule during mount and
 * updates so assertions run against a settled DOM.
 *
 * Specs that mount motion elements stub `requestAnimationFrame` onto fake
 * timers, so the RAF callbacks that promote a component from `mounting` →
 * `ready` (and the chained promises/Svelte updates they kick off) only run
 * once flushed. This helper unwinds all three layers in order:
 *
 * 1. `vi.runAllTimers()` — fire queued RAF/`setTimeout` callbacks.
 * 2. two microtask turns — drain the promise chains those callbacks start
 *    (the second turn settles promises that were themselves awaited).
 * 3. `await tick()` — let Svelte apply the resulting reactive DOM updates.
 *
 * Shared by the motion specs that previously each declared their own copy
 * (`_MotionContainer`, `LazyMotion`, `refBind`).
 *
 * @returns A promise that resolves once queued timers, microtasks, and Svelte
 *   DOM updates have settled.
 * @example
 * ```ts
 * render(MotionDiv, { props })
 * await flushTimers()
 * expect(container.firstElementChild).toBeTruthy()
 * ```
 */
export async function flushTimers(): Promise<void> {
    vi.runAllTimers()
    await Promise.resolve()
    await Promise.resolve()
    await tick()
}
