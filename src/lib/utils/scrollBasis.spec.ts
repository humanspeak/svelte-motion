import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    getScrollAncestors,
    isResizeBlocked,
    onResizeSettled,
    readScrollBasis,
    scrollDelta,
    scrollShift,
    seenScrollBasis,
    type ScrollBasis
} from './scrollBasis.js'

/**
 * Plan 015a, Design A: the scroll basis a cached layout is stamped with, and
 * the tracker that tells how far each scroll container has scrolled since.
 *
 * jsdom has no layout: `scrollTop` is writable, a window scroll is
 * `documentElement.scrollTop = n` plus a `scroll` event on `document`, and
 * `getComputedStyle` reports `overflowX`/`overflowY` as `visible` for an
 * `overflow: auto` shorthand.
 */

const notFoldedIn = Object.assign(() => false, { wasRoot: false })

/** A fresh element under `parent` with an inline style. */
const make = (style: string, parent: Element = document.body): HTMLElement => {
    const element = document.createElement('div')
    element.setAttribute('style', style)
    parent.appendChild(element)
    return element
}

/** Scroll `element` and let the tracker see it, as a browser's scroll event would. */
const scrollWithEvent = (element: HTMLElement, top: number, left = 0) => {
    element.scrollTop = top
    element.scrollLeft = left
    element.dispatchEvent(new Event('scroll'))
}

const stubScrollingElement = (value: Element | null) =>
    Object.defineProperty(document, 'scrollingElement', {
        configurable: true,
        get: () => value
    })

describe('scrollBasis (plan 015a)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        document.body.innerHTML = ''
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
    })
    afterEach(() => {
        // Remove the per-test `scrollingElement` stub (jsdom has none).
        delete (document as unknown as Record<string, unknown>).scrollingElement
        document.documentElement.removeAttribute('style')
        document.body.removeAttribute('style')
    })

    describe('getScrollAncestors', () => {
        it('2a: detects overflow:auto through the shorthand', () => {
            const scroller = make('overflow: auto')
            const style = getComputedStyle(scroller)
            // The premise: jsdom only reports the shorthand.
            expect(style.overflowY).toBe('visible')
            const element = make('', scroller)

            expect(getScrollAncestors(element).scrollers).toEqual([scroller])
        })

        it('2b: includes overflow:hidden and excludes overflow:visible', () => {
            const hidden = make('overflow: hidden')
            const visible = make('overflow: visible', hidden)
            const element = make('', visible)

            expect(getScrollAncestors(element).scrollers).toEqual([hidden])
        })

        it.each([
            ['documentElement', () => document.documentElement],
            ['null', () => null]
        ])('2c: excludes the root scroller (scrollingElement stubbed as %s)', (_, value) => {
            stubScrollingElement(value())
            document.documentElement.setAttribute('style', 'overflow: auto')
            const element = make('')

            expect(getScrollAncestors(element).scrollers).toEqual([])
        })

        it('2c: excludes body when it is the root scroller', () => {
            stubScrollingElement(document.body)
            document.body.setAttribute('style', 'overflow: auto')
            const element = make('')

            expect(getScrollAncestors(element).scrollers).toEqual([])
        })

        it('2d: includes a body scroller under html { overflow: hidden }', () => {
            stubScrollingElement(document.documentElement)
            document.documentElement.setAttribute('style', 'overflow: hidden')
            document.body.setAttribute('style', 'overflow: auto')
            const element = make('')

            expect(getScrollAncestors(element).scrollers).toEqual([document.body])
        })

        it('2e: a fixed element sets `fixed`', () => {
            const scroller = make('overflow: auto')
            const element = make('position: fixed', scroller)

            const ancestors = getScrollAncestors(element)
            expect(ancestors.fixed).toBe(true)
            // The walk stops at the element itself.
            expect(ancestors.scrollers).toEqual([])
        })

        it('2e: a fixed ancestor sets `fixed` and stops the walk', () => {
            const outer = make('overflow: auto')
            const fixed = make('position: fixed; overflow: auto', outer)
            const element = make('', make('', fixed))

            const ancestors = getScrollAncestors(element)
            expect(ancestors.fixed).toBe(true)
            expect(ancestors.scrollers).toEqual([fixed])
        })

        it('2f: a sticky node below the scroller sets `sticky`', () => {
            const scroller = make('overflow: auto')
            const sticky = make('position: sticky; top: 0', scroller)
            const element = make('', sticky)

            const ancestors = getScrollAncestors(element)
            expect(ancestors.sticky).toBe(true)
            expect(ancestors.scrollers).toEqual([scroller])
        })

        it('2f: a sticky element sets `sticky` itself', () => {
            const scroller = make('overflow: auto')
            const element = make('position: sticky; top: 0', scroller)

            expect(getScrollAncestors(element).sticky).toBe(true)
        })

        it('2f: a plain path is not sticky', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)

            expect(getScrollAncestors(element)).toEqual({
                scrollers: [scroller],
                fixed: false,
                sticky: false
            })
        })

        it('2g: crosses a shadow host', () => {
            const scroller = make('overflow: auto')
            const host = make('', scroller)
            const shadow = host.attachShadow({ mode: 'open' })
            const inner = document.createElement('div')
            shadow.appendChild(inner)

            expect(getScrollAncestors(inner).scrollers).toEqual([scroller])
        })
    })

    describe('tracker', () => {
        it('2h: reads isFoldedIn at read time', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)
            const basis = readScrollBasis(element)
            scrollWithEvent(scroller, 500)

            let folded = false
            const isFoldedIn = Object.assign(() => folded, { wasRoot: false })
            expect(scrollShift(basis, isFoldedIn)).toEqual({ x: 0, y: -500 })
            folded = true
            expect(scrollShift(basis, isFoldedIn)).toEqual({ x: 0, y: 0 })
        })

        it('2i: `seen` updates on a scroll event', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)
            readScrollBasis(element)

            scrollWithEvent(scroller, 500, 20)

            expect(seenScrollBasis(element).values).toEqual([[20, 500]])
        })

        it('2j: `seen` updates on a document click with no scroll event', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)
            readScrollBasis(element)

            scroller.scrollTop = 500
            expect(seenScrollBasis(element).values).toEqual([[0, 0]])
            document.dispatchEvent(new MouseEvent('click'))

            expect(seenScrollBasis(element).values).toEqual([[0, 500]])
        })

        it('2k: scrollDelta from 0 to 500 is 500', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)
            const from = readScrollBasis(element)
            scroller.scrollTop = 500
            const to = readScrollBasis(element)

            expect(scrollDelta(from, to, notFoldedIn)).toEqual({ x: 0, y: 500 })
        })

        it('2l: scrollDelta is 250 in a container drawn at half its size', () => {
            const scroller = make('overflow: auto')
            Object.defineProperty(scroller, 'offsetHeight', { configurable: true, value: 400 })
            Object.defineProperty(scroller, 'offsetWidth', { configurable: true, value: 400 })
            vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 200))
            const element = make('', scroller)
            const from = readScrollBasis(element)
            scroller.scrollTop = 500
            const to = readScrollBasis(element)

            expect(scrollDelta(from, to, notFoldedIn)).toEqual({ x: 0, y: 250 })
        })

        it('2m: the fixed root term has sign +1', () => {
            stubScrollingElement(document.documentElement)
            const element = make('position: fixed')
            const from = readScrollBasis(element)
            expect(from.fixedRoot).toEqual([0, 0])

            document.documentElement.scrollTop = 300
            const to = readScrollBasis(element)
            // The page box of a fixed element moves down with the window
            // scroll (upstream `measurePageBox`), the opposite of a scroller.
            expect(scrollDelta(from, to, notFoldedIn)).toEqual({ x: 0, y: -300 })
            document.dispatchEvent(new Event('scroll'))
            expect(scrollShift(from, notFoldedIn)).toEqual({ x: 0, y: 300 })
            // A `layoutScroll` fixed node is a scroll root: no root term.
            expect(
                scrollShift(
                    from,
                    Object.assign(() => false, { wasRoot: true })
                )
            ).toEqual({
                x: 0,
                y: 0
            })
        })

        it('2n: a same-epoch basis gives a zero shift', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)
            scrollWithEvent(scroller, 500)
            // A programmatic clamp with no scroll event yet: this read is
            // post-change, and the tracker still holds the pre-change 500.
            scroller.scrollTop = 430
            const basis = readScrollBasis(element)

            expect(scrollShift(basis, notFoldedIn)).toEqual({ x: 0, y: 0 })
        })

        it('2o: an unreliable (sticky) basis gives null', () => {
            const scroller = make('overflow: auto')
            const element = make('position: sticky; top: 0', scroller)
            const basis = readScrollBasis(element)
            expect(basis.unreliable).toBe(true)
            scrollWithEvent(scroller, 500)

            expect(scrollShift(basis, notFoldedIn)).toBeNull()
        })

        it('2o: a stale-resizeEpoch basis gives null', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)
            const basis = readScrollBasis(element)
            scrollWithEvent(scroller, 500)
            const stale: ScrollBasis = { ...basis, resizeEpoch: basis.resizeEpoch - 1 }

            expect(scrollShift(stale, notFoldedIn)).toBeNull()
        })

        it('2p: a basis with no terms makes no getBoundingClientRect calls', () => {
            const element = make('')
            const reads = vi.spyOn(Element.prototype, 'getBoundingClientRect')
            const basis = readScrollBasis(element)
            document.dispatchEvent(new MouseEvent('click'))

            expect(basis.scrollers).toEqual([])
            expect(basis.fixedRoot).toBeNull()
            expect(scrollShift(basis, notFoldedIn)).toEqual({ x: 0, y: 0 })
            expect(scrollDelta(basis, readScrollBasis(element), notFoldedIn)).toEqual({
                x: 0,
                y: 0
            })
            expect(reads).not.toHaveBeenCalled()
            reads.mockRestore()
        })
    })

    describe('resize', () => {
        const setViewport = (width: number, height: number) => {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: width
            })
            Object.defineProperty(window, 'innerHeight', {
                configurable: true,
                writable: true,
                value: height
            })
            window.dispatchEvent(new Event('resize'))
        }

        beforeEach(() => {
            vi.useFakeTimers()
        })
        afterEach(() => {
            vi.useRealTimers()
        })

        it('2q: a width change blocks for 250ms and fires the refresh callbacks once', () => {
            const refresh = vi.fn()
            const off = onResizeSettled(refresh)
            const width = window.innerWidth
            const height = window.innerHeight
            try {
                setViewport(width - 200, height)
                expect(isResizeBlocked()).toBe(true)
                vi.advanceTimersByTime(100)
                // Another resize event re-arms the timer.
                setViewport(width - 300, height)
                vi.advanceTimersByTime(249)
                expect(isResizeBlocked()).toBe(true)
                expect(refresh).not.toHaveBeenCalled()
                vi.advanceTimersByTime(1)
                expect(isResizeBlocked()).toBe(false)
                expect(refresh).toHaveBeenCalledTimes(1)
            } finally {
                off()
                setViewport(width, height)
                vi.advanceTimersByTime(250)
            }
        })

        it("2q: a height-only change fires the refresh callbacks but doesn't block", () => {
            const refresh = vi.fn()
            const off = onResizeSettled(refresh)
            const width = window.innerWidth
            const height = window.innerHeight
            try {
                setViewport(width, height - 180)
                expect(isResizeBlocked()).toBe(false)
                vi.advanceTimersByTime(250)
                expect(refresh).toHaveBeenCalledTimes(1)
                expect(isResizeBlocked()).toBe(false)
            } finally {
                off()
                setViewport(width, height)
                vi.advanceTimersByTime(250)
            }
        })

        it('2q: a resize makes earlier bases stale', () => {
            const scroller = make('overflow: auto')
            const element = make('', scroller)
            const basis = readScrollBasis(element)
            const width = window.innerWidth
            const height = window.innerHeight
            setViewport(width, height - 100)
            vi.advanceTimersByTime(250)
            setViewport(width, height)
            vi.advanceTimersByTime(250)

            expect(scrollShift(basis, notFoldedIn)).toBeNull()
        })
    })
})
