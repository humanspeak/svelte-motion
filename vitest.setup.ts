import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

// Mock requestAnimationFrame and related timing functions
global.requestAnimationFrame = vi.fn().mockImplementation((cb: FrameRequestCallback): number => {
    const timeoutId = setTimeout(cb, 0)
    return Number(timeoutId)
})
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id))

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
