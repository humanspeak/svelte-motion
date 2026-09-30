/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { offsetToViewTimelineRange, resolveEdge, resolveOffset } from './viewTimelineRange.js'

/**
 * Mirrors motion v13.4.7 tests:
 * `scroll/offsets/__tests__/edge.test.ts`, `offset.test.ts`, and
 * `scroll/utils/__tests__/offset-to-range.test.ts`. Expectations are unchanged
 * so a future upstream change shows up as a diff against these.
 */

// Upstream `ScrollOffset` presets (offsets/presets.ts).
const presets = {
    Enter: [
        [0, 1],
        [1, 1]
    ],
    Exit: [
        [0, 0],
        [1, 0]
    ],
    Any: [
        [1, 0],
        [0, 1]
    ],
    All: [
        [0, 0],
        [1, 1]
    ]
} as const

describe('resolveEdge', () => {
    it('handles progress numbers', () => {
        expect(resolveEdge(0, 300)).toEqual(0)
        expect(resolveEdge(0, 300, 200)).toEqual(200)
        expect(resolveEdge(0.5, 300)).toEqual(150)
        expect(resolveEdge(0.5, 300, 200)).toEqual(350)
        expect(resolveEdge(1, 300)).toEqual(300)
        expect(resolveEdge(1, 300, 200)).toEqual(500)
    })

    it('handles progress numbers as string', () => {
        expect(resolveEdge('0', 300)).toEqual(0)
        expect(resolveEdge('0', 300, 200)).toEqual(200)
        expect(resolveEdge('0.5', 300)).toEqual(150)
        expect(resolveEdge('0.5', 300, 200)).toEqual(350)
        expect(resolveEdge('1', 300)).toEqual(300)
        expect(resolveEdge('1', 300, 200)).toEqual(500)
    })

    it('handles named presets', () => {
        expect(resolveEdge('start', 300)).toEqual(0)
        expect(resolveEdge('start', 300, 200)).toEqual(200)
        expect(resolveEdge('center', 300)).toEqual(150)
        expect(resolveEdge('center', 300, 200)).toEqual(350)
        expect(resolveEdge('end', 300)).toEqual(300)
        expect(resolveEdge('end', 300, 200)).toEqual(500)
    })

    it('handles pixels', () => {
        expect(resolveEdge('0px', 300)).toEqual(0)
        expect(resolveEdge('0px', 300, 200)).toEqual(200)
        expect(resolveEdge('150px', 300)).toEqual(150)
        expect(resolveEdge('150px', 300, 200)).toEqual(350)
        expect(resolveEdge('300px', 300)).toEqual(300)
        expect(resolveEdge('300px', 300, 200)).toEqual(500)
    })

    it('handles percent', () => {
        expect(resolveEdge('0%', 300)).toEqual(0)
        expect(resolveEdge('0%', 300, 200)).toEqual(200)
        expect(resolveEdge('50%', 300)).toEqual(150)
        expect(resolveEdge('50%', 300, 200)).toEqual(350)
        expect(resolveEdge('100%', 300)).toEqual(300)
        expect(resolveEdge('100%', 300, 200)).toEqual(500)
    })

    it('handles vw', () => {
        Object.defineProperty(document.documentElement, 'clientWidth', {
            value: 1000,
            configurable: true
        })

        expect(resolveEdge('0vw', 300)).toEqual(0)
        expect(resolveEdge('0vw', 300, 200)).toEqual(200)
        expect(resolveEdge('50vw', 300)).toEqual(500)
        expect(resolveEdge('50vw', 300, 200)).toEqual(700)
        expect(resolveEdge('100vw', 300)).toEqual(1000)
        expect(resolveEdge('100vw', 300, 200)).toEqual(1200)
    })

    it('handles vh', () => {
        Object.defineProperty(document.documentElement, 'clientHeight', {
            value: 1000,
            configurable: true
        })

        expect(resolveEdge('0vh', 300)).toEqual(0)
        expect(resolveEdge('0vh', 300, 200)).toEqual(200)
        expect(resolveEdge('50vh', 300)).toEqual(500)
        expect(resolveEdge('50vh', 300, 200)).toEqual(700)
        expect(resolveEdge('100vh', 300)).toEqual(1000)
        expect(resolveEdge('100vh', 300, 200)).toEqual(1200)
    })
})

describe('resolveOffset', () => {
    it('can resolve single-value numerical edge', () => {
        expect(resolveOffset(0, 100, 500, 0)).toEqual(0)
        expect(resolveOffset(0.5, 100, 500, 0)).toEqual(200)
        expect(resolveOffset(1, 100, 500, 0)).toEqual(400)
        expect(resolveOffset(0, 100, 500, 200)).toEqual(200)
        expect(resolveOffset(0.5, 100, 500, 200)).toEqual(400)
        expect(resolveOffset(1, 100, 500, 200)).toEqual(600)
    })

    it('can resolve single-value labelled edge', () => {
        expect(resolveOffset('start', 100, 500, 0)).toEqual(0)
        expect(resolveOffset('center', 100, 500, 0)).toEqual(200)
        expect(resolveOffset('end', 100, 500, 0)).toEqual(400)
        expect(resolveOffset('start', 100, 500, 200)).toEqual(200)
        expect(resolveOffset('center', 100, 500, 200)).toEqual(400)
        expect(resolveOffset('end', 100, 500, 200)).toEqual(600)
    })

    it('can resolve single-value px', () => {
        expect(resolveOffset('100px', 100, 500, 0)).toEqual(100)
        expect(resolveOffset('500px', 100, 500, 0)).toEqual(500)
        expect(resolveOffset('100px', 100, 500, 200)).toEqual(300)
        expect(resolveOffset('500px', 100, 500, 200)).toEqual(700)
    })

    it('can resolve string intersection', () => {
        expect(resolveOffset('center start', 100, 50, 0)).toEqual(25)
        expect(resolveOffset('start center', 100, 200, 0)).toEqual(-50)
        expect(resolveOffset('start end', 100, 200, 0)).toEqual(-100)
        expect(resolveOffset('0.5 0', 100, 50, 0)).toEqual(25)
        expect(resolveOffset('0 0.5', 100, 200, 0)).toEqual(-50)
        expect(resolveOffset('0 1', 100, 200, 0)).toEqual(-100)
    })

    it('can resolve numerical intersection', () => {
        expect(resolveOffset([0, 0], 100, 50, 0)).toEqual(0)
        expect(resolveOffset([0, 0], 100, 50, 200)).toEqual(200)
        expect(resolveOffset([0, 1], 100, 50, 0)).toEqual(-100)
        expect(resolveOffset([0, 1], 100, 200, 0)).toEqual(-100)
        expect(resolveOffset([0, 1], 100, 50, 200)).toEqual(100)
        expect(resolveOffset([0, 1], 100, 200, 200)).toEqual(100)
        expect(resolveOffset([1, 1], 100, 50, 0)).toEqual(-50)
        expect(resolveOffset([1, 1], 100, 200, 0)).toEqual(100)
        expect(resolveOffset([1, 1], 100, 50, 200)).toEqual(150)
        expect(resolveOffset([1, 0], 100, 50, 0)).toEqual(50)
        expect(resolveOffset([1, 0], 100, 200, 0)).toEqual(200)
        expect(resolveOffset([1, 0], 100, 50, 200)).toEqual(250)
        expect(resolveOffset([1, 0], 100, 200, 200)).toEqual(400)
    })
})

const range = (points: string[], a: number, b: number, cover = false) =>
    expect.objectContaining({ points, a, b, cover })

const entry = range(['entry-crossing 0%', 'entry-crossing 100%'], 1, 0)
const exit = range(['exit-crossing 0%', 'exit-crossing 100%'], 1, 0)
const all = range(['exit-crossing 0%', 'entry-crossing 100%'], 1, -1)

describe('offsetToViewTimelineRange', () => {
    it('maps Enter to entry-crossing', () => {
        expect(offsetToViewTimelineRange(presets.Enter)).toEqual(entry)
        expect(offsetToViewTimelineRange(['start end', 'end end'])).toEqual(entry)
    })

    it('maps Exit to exit-crossing', () => {
        expect(offsetToViewTimelineRange(presets.Exit)).toEqual(exit)
        expect(offsetToViewTimelineRange(['start start', 'end start'])).toEqual(exit)
        expect(offsetToViewTimelineRange(['start', 'end start'])).toEqual(exit)
    })

    it("maps full cover to the ViewTimeline's default range", () => {
        const cover = range(['entry-crossing 0%', 'exit-crossing 100%'], 1, 1, true)
        expect(offsetToViewTimelineRange(['start end', 'end start'])).toEqual(cover)
        expect(
            offsetToViewTimelineRange([
                [0, 1],
                [1, 0]
            ])
        ).toEqual(cover)
    })

    it('maps Any to cover, run backwards', () => {
        const any = range(['exit-crossing 100%', 'entry-crossing 0%'], -1, -1)
        expect(offsetToViewTimelineRange(presets.Any)).toEqual(any)
        expect(offsetToViewTimelineRange(['end start', 'start end'])).toEqual(any)
    })

    /**
     * a x target length + b x container length changes sign when the target
     * becomes longer than the container.
     */
    it('maps All and the default offset with a size-dependent direction', () => {
        expect(offsetToViewTimelineRange(undefined)).toEqual(all)
        expect(offsetToViewTimelineRange(presets.All)).toEqual(all)
        expect(offsetToViewTimelineRange(['start start', 'end end'])).toEqual(all)
        expect(offsetToViewTimelineRange([0, 1])).toEqual(all)
        expect(offsetToViewTimelineRange(['end end', 'start start'])).toEqual(
            range(['entry-crossing 100%', 'exit-crossing 0%'], -1, 1)
        )
    })

    it('maps partial ranges across the container edges', () => {
        expect(offsetToViewTimelineRange(['center end', 'center start'])).toEqual(
            range(['entry-crossing 50%', 'exit-crossing 50%'], 0, 1)
        )
        expect(
            offsetToViewTimelineRange([
                [0.25, 1],
                [0.75, 0]
            ])
        ).toEqual(range(['entry-crossing 25%', 'exit-crossing 75%'], 0.5, 1))
        expect(offsetToViewTimelineRange(['center start', 'end end'])).toEqual(
            range(['exit-crossing 50%', 'entry-crossing 100%'], 0.5, -1)
        )
    })

    it("doesn't map identical points", () => {
        expect(offsetToViewTimelineRange(['start start', 'start start'])).toBeUndefined()
    })

    it("doesn't map container edges other than start and end", () => {
        expect(offsetToViewTimelineRange(['start center', 'end start'])).toBeUndefined()
        expect(
            offsetToViewTimelineRange([
                [0.5, 0],
                [1, 0.5]
            ])
        ).toBeUndefined()
    })

    it("doesn't map absolute lengths", () => {
        expect(offsetToViewTimelineRange(['100px end', 'end start'])).toBeUndefined()
        expect(offsetToViewTimelineRange(['start end', 'end 50vh'])).toBeUndefined()
    })

    it("doesn't map anything but two offsets", () => {
        expect(offsetToViewTimelineRange([[0, 0]])).toBeUndefined()
        expect(
            offsetToViewTimelineRange(['start end', 'center center', 'end start'])
        ).toBeUndefined()
    })
})
