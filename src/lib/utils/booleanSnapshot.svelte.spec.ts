import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { createBooleanSnapshot } from './booleanSnapshot.svelte.js'

describe('createBooleanSnapshot', () => {
    it('a same-value set is a no-op', () => {
        const [state, set] = createBooleanSnapshot(false)
        const seen: boolean[] = []
        const off = state.subscribe((v) => seen.push(v))
        set(false)
        off()
        expect(state.current).toBe(false)
        // Only the synchronous initial emit from `subscribe`.
        expect(seen).toEqual([false])
    })

    it('applies a set(false) from an effect cleanup in the same update as set(true)', () => {
        // Inside an effect cleanup Svelte shows `$state` as it was before the
        // current update, so a same-value check against `current` would see
        // the stale `false` and skip this write.
        const [state, set] = createBooleanSnapshot(false)
        let dep = $state(0)
        const stop = $effect.root(() => {
            $effect(() => {
                void dep
                return () => set(false)
            })
        })
        flushSync()
        const seen: boolean[] = []
        const off = state.subscribe((v) => seen.push(v))

        set(true)
        dep = 1
        flushSync()

        expect(state.current).toBe(false)
        expect(seen).toEqual([false, true, false])
        off()
        stop()
    })
})
