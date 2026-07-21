import { render } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresenceKeyHarness from './__tests__/PresenceKeyHarness.svelte'

describe('AnimatePresence direct-child key validation', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
    })

    it('accepts falsy-but-valid keys like 0', () => {
        const { container } = render(PresenceKeyHarness, { props: { key: 0 } })
        expect(container.querySelector('[data-testid="presence-key-box"]')).toBeTruthy()
    })

    it('accepts string keys', () => {
        const { container } = render(PresenceKeyHarness, { props: { key: 'box' } })
        expect(container.querySelector('[data-testid="presence-key-box"]')).toBeTruthy()
    })

    it('throws a helpful error when the key is missing', () => {
        expect(() => render(PresenceKeyHarness)).toThrow(/must have a `key` prop/)
    })
})
