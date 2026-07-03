import { render } from '@testing-library/svelte'
import { isMotionValue } from 'motion-dom'
import { flushSync, mount, unmount } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import GetterSourceProbe from './__tests__/GetterSourceProbe.svelte'
import HookLifecycleHarness from './__tests__/HookLifecycleHarness.svelte'
import type { AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { motionValue } from './vanillaValues.svelte.js'

// Characterization tests pinning the hook behaviors that the
// hooks-delegate-to-vanilla-factories refactor must preserve.

type Captured = {
    x: AugmentedMotionValue<number>
    doubled: AugmentedMotionValue<number>
    mapped?: AugmentedMotionValue<number>
    outputMap?: { a: AugmentedMotionValue<number>; b: AugmentedMotionValue<number> }
}

/** A readable store that counts its active subscriptions. */
const countingReadable = (initial: number) => {
    let value = initial
    const runs = new Set<(v: number) => void>()
    let active = 0
    return {
        get activeSubscriptions() {
            return active
        },
        set(next: number) {
            value = next
            runs.forEach((run) => run(value))
        },
        subscribe(run: (v: number) => void) {
            active++
            runs.add(run)
            run(value)
            return () => {
                active--
                runs.delete(run)
            }
        }
    }
}

const mountHarness = (source?: ReturnType<typeof countingReadable>) => {
    let captured: Captured | undefined
    const utils = render(HookLifecycleHarness, {
        props: {
            source,
            onvalues: (values: Captured) => (captured = values)
        }
    })
    if (!captured) throw new Error('harness did not expose values')
    return { ...utils, values: captured }
}

describe('hook/vanilla parity — shared value shape', () => {
    it('hook and vanilla values expose an identical surface', () => {
        const { values, unmount } = mountHarness()
        const vanilla = motionValue(1)

        for (const value of [values.x, vanilla]) {
            expect(isMotionValue(value)).toBe(true)
            expect(value.current).toBe(1)
            expect(typeof value.subscribe).toBe('function')
            expect(typeof value.destroy).toBe('function')
            value.set(3)
            expect(value.get()).toBe(3)
            expect(value.current).toBe(3)
        }

        vanilla.destroy()
        unmount()
    })
})

describe('hook lifecycle — auto-destroy on unmount', () => {
    it('useMotionValue stops notifying subscribers after unmount', () => {
        const { values, unmount } = mountHarness()
        const seen: number[] = []
        values.x.subscribe((v) => seen.push(v))
        values.x.set(5)
        expect(seen).toEqual([1, 5])

        unmount()
        values.x.set(9)
        expect(seen).toEqual([1, 5]) // destroyed: listeners cleared
    })

    it('useTransform compute values stop updating after unmount', async () => {
        const { values, unmount } = mountHarness()
        values.x.set(4)
        await vi.advanceTimersByTimeAsync(100)
        expect(values.doubled.get()).toBe(8)

        unmount()
        values.x.set(10)
        await vi.advanceTimersByTimeAsync(100)
        expect(values.doubled.get()).toBe(8) // destroyed: no recompute
    })
})

describe('hook lifecycle — readable-source bridges', () => {
    it('mapping form bridges a readable and updates through it', async () => {
        const source = countingReadable(0)
        const { values, unmount } = mountHarness(source)
        expect(values.mapped?.get()).toBe(0)

        source.set(5)
        await vi.advanceTimersByTimeAsync(100)
        expect(values.mapped?.get()).toBe(50)
        unmount()
    })

    it('unsubscribes every source bridge on unmount', () => {
        const source = countingReadable(0)
        const { unmount } = mountHarness(source)
        expect(source.activeSubscriptions).toBeGreaterThan(0)

        unmount()
        expect(source.activeSubscriptions).toBe(0)
    })

    it('the multi-output map form shares ONE bridge across its keys', async () => {
        const source = countingReadable(0)
        const { values, unmount } = mountHarness(source)
        // mapped uses one subscription; the outputMap (2 keys) must add
        // only one more — per-key bridging would make this 3.
        expect(source.activeSubscriptions).toBe(2)

        source.set(10)
        await vi.advanceTimersByTimeAsync(100)
        expect(values.outputMap?.a.get()).toBe(100)
        expect(values.outputMap?.b.get()).toBe(0)
        unmount()
    })
})

describe('useTransform — rune getter sources (unlocked by the unification)', () => {
    it('maps a $state-driven getter source through ranges', async () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const probe = mount(GetterSourceProbe, { target: host })

        expect(probe.mapped.get()).toBe(0)
        probe.setSource(5)
        flushSync()
        await vi.advanceTimersByTimeAsync(100)
        expect(probe.mapped.get()).toBe(50)

        unmount(probe)
        host.remove()
    })

    it('useSpring follows a $state-driven getter source', async () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const probe = mount(GetterSourceProbe, { target: host })

        expect(probe.smooth.get()).toBe(0)
        probe.setSource(100)
        flushSync()
        await vi.advanceTimersByTimeAsync(2000)
        expect(probe.smooth.get()).toBeGreaterThan(0)

        unmount(probe)
        host.remove()
    })
})
