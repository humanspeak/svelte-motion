import { describe, expect, it } from 'vitest'
import { findPop, formatTrace, type RecordedFrame } from './jumpTrace'

/** Frames 16ms apart with #a present, from a list of tops. */
const trace = (tops: (number | null)[], trigger = true): RecordedFrame[] =>
    tops.map((top, index) => ({ t: index * 16, top, trigger }))

const options = { jumpPx: 30, settleTop: 20, earliestSettleMs: 1300 }

describe('findPop', () => {
    it('reports a smooth glide as no pop', () => {
        // Held for the 300ms exit, then a 1s linear glide from 160 to 20.
        const frames: RecordedFrame[] = Array.from({ length: 125 }, (_, i) => {
            const t = i * 16
            const progress = Math.min(1, Math.max(0, (t - 300) / 1000))
            return { t, top: 160 - 140 * progress, trigger: t < 300 }
        })
        expect(findPop(frames, options)).toBeNull()
    })

    it('flags a single-frame upward jump larger than jumpPx', () => {
        const pop = findPop(trace([160, 160, 100, 98]), { ...options, settleTop: null })
        expect(pop).toMatchObject({ frame: 2, t: 32 })
        expect(pop?.reason).toContain('60.0 px up')
    })

    it('ignores downward moves and small upward steps', () => {
        expect(findPop(trace([20, 160, 150, 130, 101]), { ...options, settleTop: null })).toBeNull()
    })

    it('flags reaching the settle position before the glide could', () => {
        // Creeps up in small steps (no single jump), but reaches 20 at 64ms.
        const pop = findPop(trace([80, 60, 40, 20.2]), options)
        expect(pop).toMatchObject({ frame: 3, t: 48 })
        expect(pop?.reason).toContain('settle position 20.0')
    })

    it('accepts the settle position once the glide may have reached it', () => {
        const frames: RecordedFrame[] = [
            { t: 0, top: 22, trigger: false },
            { t: 1300, top: 20, trigger: false }
        ]
        expect(findPop(frames, options)).toBeNull()
    })

    it('does not compare across frames where the target was missing', () => {
        expect(findPop(trace([160, null, 100]), { ...options, settleTop: null })).toBeNull()
    })
})

describe('formatTrace', () => {
    it('collapses runs of identical frames into one line', () => {
        const frames = [...trace([160, 160, 160]), { t: 48, top: 20, trigger: false }]
        const lines = formatTrace(frames, 'a').split('\n')
        expect(lines).toHaveLength(2)
        expect(lines[0]).toMatch(/^#0–#2\s+\+0…32ms\s+top\s+160\.0 {2}a$/)
        expect(lines[1]).toMatch(/^#3\s+\+48ms\s+top\s+20\.0$/)
    })

    it('marks frames where the target is gone', () => {
        expect(formatTrace(trace([null]), 'a')).toContain('top   gone')
    })

    it('returns an empty string for no frames', () => {
        expect(formatTrace([], 'a')).toBe('')
    })
})
