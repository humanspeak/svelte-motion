import { vi } from 'vitest'

/** Subset of `IntersectionObserverEntry` that the mock callback consumes. */
export type MockIOEntry = Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>

export type MockIntersectionObserverInstance = {
    callback: IntersectionObserverCallback
    elements: Element[]
    observe: ReturnType<typeof vi.fn>
    unobserve: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    takeRecords: ReturnType<typeof vi.fn>
    fire: (entries: MockIOEntry[]) => void
}

export type MockIntersectionObserverHandle = {
    /** Constructor for `globalThis.IntersectionObserver` (use with `vi.stubGlobal`). */
    Class: typeof IntersectionObserver
    /** All observer instances created via `new IntersectionObserver(...)`. */
    instances: () => MockIntersectionObserverInstance[]
    /** Reset the instance registry between tests. */
    reset: () => void
    /**
     * Fire an intersection event on every observer that is currently watching
     * `target`. `isIntersecting` controls whether the entry counts as an enter
     * or exit.
     */
    fireOn: (target: Element, isIntersecting: boolean) => void
}

/**
 * Build an `IntersectionObserver` test double. Lives under `__tests__/` so
 * it's excluded from the published bundle and can freely import `vitest`.
 *
 * @example
 * ```ts
 * const io = createMockIntersectionObserver()
 * vi.stubGlobal('IntersectionObserver', io.Class)
 * io.fireOn(element, true)  // enter
 * io.fireOn(element, false) // exit
 * ```
 */
export const createMockIntersectionObserver = (): MockIntersectionObserverHandle => {
    const instances: MockIntersectionObserverInstance[] = []

    class MockIntersectionObserver {
        callback: IntersectionObserverCallback
        elements: Element[] = []
        observe = vi.fn((el: Element) => {
            this.elements.push(el)
        })
        unobserve = vi.fn((el: Element) => {
            this.elements = this.elements.filter((e) => e !== el)
        })
        disconnect = vi.fn(() => {
            this.elements = []
        })
        takeRecords = vi.fn((): IntersectionObserverEntry[] => [])
        constructor(callback: IntersectionObserverCallback) {
            this.callback = callback
            instances.push(this)
        }
        fire(entries: MockIOEntry[]) {
            this.callback(
                entries as IntersectionObserverEntry[],
                this as unknown as IntersectionObserver
            )
        }
    }

    return {
        Class: MockIntersectionObserver as unknown as typeof IntersectionObserver,
        instances: () => instances,
        reset: () => {
            instances.length = 0
        },
        fireOn: (target, isIntersecting) => {
            for (const obs of instances) {
                if (obs.elements.includes(target)) obs.fire([{ target, isIntersecting }])
            }
        }
    }
}
