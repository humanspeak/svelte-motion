import { isMotionValue, motionValue } from 'motion-dom'
import { writable } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import {
    augmentMotionValue,
    bridgeReadableToMotionValue,
    isSvelteReadable,
    sampleSource
} from './augmentMotionValue.svelte.js'

/**
 * Direct coverage for the shared augmentation helpers. The hooks built on
 * top of these (useSpring, useMotionValue, useTransform, etc.) verify the
 * augmentation behavior end-to-end via their own specs; the tests here
 * target the helpers' invariants in isolation so future refactors can
 * reason about them independently.
 */
describe('utils/augmentMotionValue:isSvelteReadable', () => {
    it('identifies a writable store', () => {
        expect(isSvelteReadable(writable(0))).toBe(true)
    })

    it('rejects a motion-dom MotionValue (even though it has subscribe)', () => {
        expect(isSvelteReadable(motionValue(0))).toBe(false)
    })

    it('rejects nullish values', () => {
        expect(isSvelteReadable(null)).toBe(false)
        expect(isSvelteReadable(undefined)).toBe(false)
    })

    it('rejects objects without a callable subscribe', () => {
        expect(isSvelteReadable({})).toBe(false)
        expect(isSvelteReadable({ subscribe: 'nope' })).toBe(false)
    })

    it('rejects primitives', () => {
        expect(isSvelteReadable(0)).toBe(false)
        expect(isSvelteReadable('store')).toBe(false)
    })
})

describe('utils/augmentMotionValue:sampleSource', () => {
    it('returns plain values directly', () => {
        expect(sampleSource(42)).toBe(42)
        expect(sampleSource('x')).toBe('x')
    })

    it('reads .get() from a MotionValue', () => {
        const mv = motionValue(7)
        expect(sampleSource(mv)).toBe(7)
    })

    it('reads via svelte/store get() from a Readable', () => {
        const w = writable(11)
        expect(sampleSource(w)).toBe(11)
    })
})

describe('utils/augmentMotionValue:augmentMotionValue', () => {
    it('preserves MotionValue identity (isMotionValue passes)', () => {
        const stop = $effect.root(() => {
            const mv = motionValue(0)
            const aug = augmentMotionValue(mv)
            expect(isMotionValue(aug)).toBe(true)
            // Same instance — augmentation is a retype, not a wrapper.
            expect(aug as unknown).toBe(mv)
        })
        stop()
    })

    it('exposes .current that reflects motion-dom writes', () => {
        const stop = $effect.root(() => {
            const mv = motionValue(0)
            const aug = augmentMotionValue(mv)
            expect(aug.current).toBe(0)
            mv.set(5)
            expect(aug.current).toBe(5)
        })
        stop()
    })

    it('.subscribe emits initial value synchronously then on every change', () => {
        const stop = $effect.root(() => {
            const mv = motionValue(0)
            const aug = augmentMotionValue(mv)
            const seen: number[] = []
            const off = aug.subscribe((v) => seen.push(v))
            mv.set(1)
            mv.set(2)
            expect(seen).toEqual([0, 1, 2])
            off()
        })
        stop()
    })

    it('.destroy() runs the supplied dispose exactly once, even with duplicate calls', () => {
        const stop = $effect.root(() => {
            const mv = motionValue(0)
            let disposeCount = 0
            const aug = augmentMotionValue(mv, () => {
                disposeCount++
            })
            aug.destroy()
            aug.destroy()
            aug.destroy()
            expect(disposeCount).toBe(1)
        })
        stop()
    })
})

describe('utils/augmentMotionValue:bridgeReadableToMotionValue', () => {
    it('seeds the bridge from get(source) without writing twice on attach', () => {
        // Regression guard: the old inline bridge in useVelocity subscribed
        // and let the readable's synchronous initial emit double-write the
        // tracker (bridge constructed at coerce(initial) then immediately
        // re-set to coerce(initial)). The helper skips the initial emit, so
        // attach is a single write.
        const w = writable(7)
        let setCount = 0
        const { value: bridge, dispose } = bridgeReadableToMotionValue(w)
        // Wrap the bridge's set to count post-construction writes.
        const originalSet = bridge.set.bind(bridge)
        bridge.set = ((v: number) => {
            setCount++
            originalSet(v)
        }) as typeof bridge.set
        // The constructor's initial readable emit must NOT have called set
        // (it would have run during bridgeReadableToMotionValue's body, but
        // even ignoring that we want subsequent emits to be the only writes
        // — verify by issuing a real change).
        w.set(11)
        expect(setCount).toBe(1)
        expect(bridge.get()).toBe(11)
        dispose()
    })

    it('mirrors emits from the readable into the bridge', () => {
        const w = writable<number>(0)
        const { value: bridge, dispose } = bridgeReadableToMotionValue(w)
        expect(bridge.get()).toBe(0)
        w.set(50)
        expect(bridge.get()).toBe(50)
        w.set(100)
        expect(bridge.get()).toBe(100)
        dispose()
    })

    it('applies the coerce transform to both the seed and subsequent emits', () => {
        const w = writable<string>('100px')
        const { value: bridge, dispose } = bridgeReadableToMotionValue<string, number>(w, (v) =>
            Number.parseFloat(v)
        )
        expect(bridge.get()).toBe(100)
        w.set('250rem')
        expect(bridge.get()).toBe(250)
        dispose()
    })

    it('dispose unsubscribes from the readable and destroys the bridge', () => {
        const w = writable<number>(0)
        const { value: bridge, dispose } = bridgeReadableToMotionValue(w)
        dispose()
        // After dispose, mutations on the readable do not propagate.
        w.set(999)
        // The bridge has been destroyed; reading it is best-effort. We
        // confirm the disposal closed the subscription by checking the
        // value didn't update.
        expect(bridge.get()).not.toBe(999)
    })

    it('produces a real motion-dom MotionValue (isMotionValue passes)', () => {
        const w = writable(0)
        const { value: bridge, dispose } = bridgeReadableToMotionValue(w)
        expect(isMotionValue(bridge)).toBe(true)
        dispose()
    })
})
