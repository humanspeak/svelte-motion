/**
 * Pins Motion 14.13's `mass: "auto"` spring option, which arrives with the
 * motion-dom pin. The transition type widens to `mass?: number | "auto"`
 * (upstream `packages/motion-dom/src/animation/types.ts:339` at v14.14.0), and
 * the spring generator no longer warns about it
 * (`packages/motion-dom/src/animation/generators/spring.ts:206-211` at v14.14.0).
 * In a layout animation, motion-dom's projection node turns it into a mass
 * taken from the element's size; elsewhere it falls back to the default mass.
 *
 * Upstream commits: `ddf846689`, `62e6f45a6`, `e846c6938`.
 */
import { describe, expect, it, vi } from 'vitest'
import { spring } from '../index.js'

describe('spring mass "auto"', () => {
    it("a spring with mass 'auto' does not warn", () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        spring({ keyframes: [0, 100], stiffness: 100, damping: 10, mass: 'auto' })
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })

    it('an invalid mass still warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        spring({ keyframes: [0, 100], stiffness: 100, damping: 10, mass: -1 })
        expect(warn).toHaveBeenCalled()
        warn.mockRestore()
    })

    it("outside a layout animation, mass 'auto' behaves like the default mass", () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const auto = spring({
            keyframes: [0, 100],
            stiffness: 100,
            damping: 10,
            mass: 'auto'
        })
        const fallback = spring({ keyframes: [0, 100], stiffness: 100, damping: 10 })
        expect(auto.next(100).value).toBeCloseTo(fallback.next(100).value, 6)
        warn.mockRestore()
    })
})
