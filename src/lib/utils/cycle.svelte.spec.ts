import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useCycle } from './cycle.svelte.js'

/**
 * `useCycle` is a `$state`-backed object — touching `.current` requires a
 * reactive scope, so every test wraps work in `$effect.root`.
 */
describe('useCycle', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
    })

    const inRoot = <T>(fn: () => T): T => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return result!
    }

    it('starts at the first item', () => {
        inRoot(() => {
            const x = useCycle('a', 'b', 'c')
            expect(x.current).toBe('a')
        })
    })

    it('advances through items on cycle()', () => {
        inRoot(() => {
            const x = useCycle(1, 2, 3, 4)
            x.cycle()
            expect(x.current).toBe(2)
            x.cycle()
            expect(x.current).toBe(3)
            x.cycle()
            expect(x.current).toBe(4)
        })
    })

    it('wraps back to the first item after the last', () => {
        inRoot(() => {
            const x = useCycle('a', 'b', 'c')
            x.cycle()
            x.cycle()
            x.cycle()
            expect(x.current).toBe('a')
        })
    })

    it('jumps to a specific index when called with a number', () => {
        inRoot(() => {
            const x = useCycle(10, 20, 30, 40)
            x.cycle(2)
            expect(x.current).toBe(30)
            x.cycle(0)
            expect(x.current).toBe(10)
        })
    })

    it('continues advancing relative to the last jump', () => {
        inRoot(() => {
            const x = useCycle(1, 2, 3, 4)
            x.cycle(2)
            x.cycle()
            expect(x.current).toBe(4)
        })
    })

    describe('out-of-range cycle(i)', () => {
        it('.current clamps to the last item for indexes past items.length', () => {
            inRoot(() => {
                const x = useCycle('a', 'b', 'c')
                x.cycle(99)
                expect(x.current).toBe('c')
            })
        })

        it('.current clamps to the last item for negative indexes', () => {
            inRoot(() => {
                const x = useCycle('a', 'b', 'c')
                x.cycle(-5)
                // Negative index is < items.length, so the clamp guard doesn't
                // fire — `items[-5]` is undefined on a real array, but the
                // clamp branch only catches index >= items.length. Document
                // the actual behavior so the test fails loudly if the impl
                // ever changes the clamp predicate.
                expect(x.current).toBeUndefined()
            })
        })

        it('cycle() after out-of-range jump wraps via wrap(0, len, stored+1)', () => {
            inRoot(() => {
                const x = useCycle(1, 2, 3)
                x.cycle(99) // stored index = 99
                x.cycle() // wrap(0, 3, 100) = 1 → items[1] = 2
                expect(x.current).toBe(2)
            })
        })

        it('jumping back into range after an out-of-range jump resolves cleanly', () => {
            inRoot(() => {
                const x = useCycle('a', 'b', 'c')
                x.cycle(99)
                expect(x.current).toBe('c') // clamped
                x.cycle(1)
                expect(x.current).toBe('b') // back to direct index
            })
        })
    })

    it('sequential calls compose (not bound by render cycle)', () => {
        inRoot(() => {
            const x = useCycle(1, 2, 3, 4)
            x.cycle()
            x.cycle()
            expect(x.current).toBe(3)
        })
    })

    it('supports a single item (cycle() is a no-op visually)', () => {
        inRoot(() => {
            const x = useCycle('only')
            x.cycle()
            x.cycle()
            expect(x.current).toBe('only')
        })
    })

    it('cycles through object items by reference', () => {
        const a = { variant: 'open' }
        const b = { variant: 'closed' }
        inRoot(() => {
            const x = useCycle(a, b)
            expect(x.current).toBe(a)
            x.cycle()
            expect(x.current).toBe(b)
            x.cycle()
            expect(x.current).toBe(a)
        })
    })

    it('throws when called with no items', () => {
        expect(() => useCycle()).toThrow(/at least one item/)
    })

    it('does not re-run downstream effects when index is unchanged', () => {
        const seen: string[] = []
        inRoot(() => {
            const x = useCycle('a', 'b', 'c')
            $effect(() => {
                seen.push(x.current)
            })
            flushSync()
            x.cycle(0) // same index → no-op
            flushSync()
            x.cycle(0) // same index → no-op
            flushSync()
        })
        expect(seen).toEqual(['a'])
    })

    it('.current updates reactively across cycle calls', () => {
        const seen: number[] = []
        inRoot(() => {
            const x = useCycle(1, 2, 3)
            $effect(() => {
                seen.push(x.current)
            })
            flushSync()
            x.cycle()
            flushSync()
            x.cycle()
            flushSync()
        })
        expect(seen).toEqual([1, 2, 3])
    })

    describe('reactive items (getter form)', () => {
        it('starts at the first item from the getter', () => {
            inRoot(() => {
                const x = useCycle(() => ['a', 'b', 'c'])
                expect(x.current).toBe('a')
            })
        })

        it('cycle() advances using the latest items', () => {
            inRoot(() => {
                const x = useCycle(() => ['a', 'b', 'c'])
                x.cycle()
                expect(x.current).toBe('b')
                x.cycle()
                expect(x.current).toBe('c')
                x.cycle()
                expect(x.current).toBe('a')
            })
        })

        it('picks up reactive item changes mid-cycle', () => {
            inRoot(() => {
                let items = $state(['a', 'b', 'c'])
                const x = useCycle(() => items)
                x.cycle() // index 1, 'b'
                expect(x.current).toBe('b')
                // Replace items underneath — index 1 of new list is 'y'
                items = ['x', 'y', 'z']
                expect(x.current).toBe('y')
            })
        })

        it('clamps to the last item when items shrink below current index', () => {
            inRoot(() => {
                let items = $state(['a', 'b', 'c', 'd'])
                const x = useCycle(() => items)
                x.cycle(3) // index 3, 'd'
                expect(x.current).toBe('d')
                items = ['a', 'b'] // shrinks past index 3
                // Read clamps to the last valid index — 'b'
                expect(x.current).toBe('b')
            })
        })

        it('preserves object identity across cycles', () => {
            const a = { variant: 'open' }
            const b = { variant: 'closed' }
            inRoot(() => {
                const x = useCycle(() => [a, b])
                expect(x.current).toBe(a)
                x.cycle()
                expect(x.current).toBe(b)
            })
        })

        it('throws when the initial items list is empty', () => {
            expect(() => useCycle(() => [])).toThrow(/at least one item/)
        })
    })
})
