import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

// Mock requestAnimationFrame and related timing functions. The mock keeps
// its own PENDING registry (added on schedule, removed on invoke/cancel):
// sinon fake timers swap the GLOBAL per test, but motion-dom's frameloop
// captures this mock at module load, so the frame-loop heal in beforeEach
// below must reach state the swapped-out global can't provide. A registry
// of genuinely pending callbacks (rather than vi.fn call records) keeps
// the heal exact — never re-invoking already-run or cancelled callbacks —
// and O(1) in memory across long worker runs.
const pendingRafCallbacks = new Map<number, FrameRequestCallback>()
global.requestAnimationFrame = vi.fn().mockImplementation((cb: FrameRequestCallback): number => {
    const handle = setTimeout(() => {
        pendingRafCallbacks.delete(handle as unknown as number)
        cb(0 as unknown as DOMHighResTimeStamp)
    }, 0)
    // Return the actual handle, but type it as a number for the DOM signature
    pendingRafCallbacks.set(handle as unknown as number, cb)
    return handle as unknown as number
})
global.cancelAnimationFrame = vi.fn((id: number) => {
    pendingRafCallbacks.delete(id)
    const handle = id as unknown as NodeJS.Timeout
    clearTimeout(handle)
})

// Reset mocks between tests
beforeEach(() => {
    vi.useFakeTimers()
    // Heal motion-dom's frame loop. Each test gets a fresh fake clock, so
    // an rAF scheduled near the end of the PREVIOUS test (e.g. by the
    // frame.read that MotionValue change-unsubscribers enqueue) is
    // silently dropped with that test's clock — but the batcher's
    // `runNextFrame` flag stays true, and `frame.*()` only wakes the
    // scheduler when the flag is false. Every frame-driven update
    // (computed values, springs, velocity) in the worker is then frozen.
    // Invoking the still-pending callbacks processes stale queues and
    // resets the flag. NOTE: an afterEach flush can't replace this —
    // processing a keepAlive batch RESCHEDULES it, re-stranding the flag
    // one layer later.
    const stale = [...pendingRafCallbacks.values()]
    pendingRafCallbacks.clear()
    for (const cb of stale) cb(performance.now())
})

afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
})

// Mock window.matchMedia globally
const mockMatchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    // Add these properties to better match the MediaQueryList interface
    matchMedia: true,
    mediaQueryList: true,
    // Add a method to simulate media query changes
    simulateChange: (matches: boolean) => {
        mockMatchMedia.mock.results[0].value.matches = matches
        if (mockMatchMedia.mock.results[0].value.onchange) {
            mockMatchMedia.mock.results[0].value.onchange()
        }
    }
}))

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia
})

// jsdom doesn't ship the Web Animations API; motion's WAAPI animator calls
// element.animate() and reads .finished. Stub just enough surface to let
// scoped animations run synchronously to completion.
if (!HTMLElement.prototype.animate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(HTMLElement.prototype as any).animate = vi.fn(() => ({
        cancel: vi.fn(),
        commitStyles: vi.fn(),
        finish: vi.fn(),
        finished: Promise.resolve(),
        pause: vi.fn(),
        play: vi.fn(),
        playState: 'finished',
        currentTime: 0,
        playbackRate: 1,
        startTime: 0,
        timeline: null,
        effect: null,
        id: '',
        replaceState: 'active',
        ready: Promise.resolve(),
        pending: false,
        updatePlaybackRate: vi.fn(),
        persist: vi.fn(),
        reverse: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        oncancel: null,
        onfinish: null,
        onremove: null
    }))
}
