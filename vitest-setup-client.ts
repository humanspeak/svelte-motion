import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    enumerable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
    }))
})

// add more mocks here if you need them
// Note for future authors: this environment installs vitest fake timers by
// default somewhere upstream (likely `svelteTesting()` from
// @testing-library/svelte/vite), which freezes motion-dom's frame loop
// (`rAF` + `setTimeout` both never fire). Specs that need a real frame loop
// — anything driving motion-dom's `frame.render` / `frame.update` — must
// call `vi.useRealTimers()` in their own `beforeEach`.
