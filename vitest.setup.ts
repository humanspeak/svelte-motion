import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

// Mock requestAnimationFrame and related timing functions
global.requestAnimationFrame = vi.fn().mockImplementation((cb: FrameRequestCallback): number => {
    const handle = setTimeout(() => cb(0 as unknown as DOMHighResTimeStamp), 0)
    // Return the actual handle, but type it as a number for the DOM signature
    return handle as unknown as number
})
global.cancelAnimationFrame = vi.fn((id: number) => {
    const handle = id as unknown as NodeJS.Timeout
    clearTimeout(handle)
})

// Reset mocks between tests
beforeEach(() => {
    vi.useFakeTimers()
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
