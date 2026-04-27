import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { useCycle } from './cycle.js'

describe('utils/cycle - useCycle', () => {
    it('starts at the first item', () => {
        const [value] = useCycle('a', 'b', 'c')
        expect(get(value)).toBe('a')
    })

    it('advances through items on cycle()', () => {
        const [value, cycle] = useCycle(1, 2, 3, 4)
        const seen: number[] = []
        const unsub = value.subscribe((v) => seen.push(v))

        cycle()
        cycle()
        cycle()

        expect(seen).toEqual([1, 2, 3, 4])
        unsub()
    })

    it('does not notify subscribers when the resolved index is unchanged', () => {
        const [value, cycle] = useCycle('a', 'b', 'c')
        const seen: string[] = []
        const unsub = value.subscribe((v) => seen.push(v))

        cycle(0)
        cycle(0)

        expect(seen).toEqual(['a'])
        unsub()
    })

    it('wraps back to the first item after the last', () => {
        const [value, cycle] = useCycle('a', 'b', 'c')
        cycle()
        cycle()
        cycle()
        expect(get(value)).toBe('a')
    })

    it('jumps to a specific index when called with a number', () => {
        const [value, cycle] = useCycle(10, 20, 30, 40)
        cycle(2)
        expect(get(value)).toBe(30)

        cycle(0)
        expect(get(value)).toBe(10)
    })

    it('continues advancing relative to the last jump', () => {
        const [value, cycle] = useCycle(1, 2, 3, 4)
        cycle(2)
        cycle()
        expect(get(value)).toBe(4)
    })

    it('is not bound by the render cycle - sequential calls compose', () => {
        const [value, cycle] = useCycle(1, 2, 3, 4)
        cycle()
        cycle()
        expect(get(value)).toBe(3)
    })

    it('supports a single item (cycle() is a no-op visually)', () => {
        const [value, cycle] = useCycle('only')
        cycle()
        cycle()
        expect(get(value)).toBe('only')
    })

    it('throws when called with no items', () => {
        expect(() => useCycle()).toThrow(/at least one item/)
    })

    it('cycles through object items', () => {
        const a = { variant: 'open' }
        const b = { variant: 'closed' }
        const [value, cycle] = useCycle(a, b)

        expect(get(value)).toBe(a)
        cycle()
        expect(get(value)).toBe(b)
        cycle()
        expect(get(value)).toBe(a)
    })
})
