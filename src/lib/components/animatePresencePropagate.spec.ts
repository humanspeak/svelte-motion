import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Clone exits resolve at once (as in `src/lib/html/_MotionContainer.spec.ts`);
// real-node exits are held by the spies in `mountGroup`.
vi.mock('motion', () => ({
    animate: vi.fn(() => ({ finished: Promise.resolve() }))
}))

/**
 * Like `$lib/__tests__/flushTimers`, but bounded: a clone-path child polls
 * its styles every frame, so `vi.runAllTimers()` would never return.
 */
const flushTimers = async () => {
    for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(20)
        await Promise.resolve()
        await tick()
    }
}

type Props = {
    form?: 'owned' | 'legacy' | 'empty'
    propagate?: boolean
    innerShown?: boolean
}

/**
 * Mount the harness with every motion element's `'exit'` activation held
 * until the test completes it (pattern: `controlledOwnedGroup` in
 * `_MotionContainer.spec.ts`).
 */
async function mountGroup(props: Props) {
    const { default: Harness } = await import('./__tests__/PropagateHarness.svelte')
    const { visualElementStore } = await import('motion-dom')
    const onExitComplete = vi.fn()
    let current: Props & { outer: boolean } = { outer: true, ...props }
    const result = render(Harness, { props: { ...current, onExitComplete } })
    await flushTimers()

    const exits = new Map<string, ReturnType<typeof Promise.withResolvers<void>>[]>()
    for (const id of ['outer', 'inner']) {
        const element = result.queryByTestId(id)
        if (!element) continue
        const state = visualElementStore.get(element)?.animationState
        if (!state) continue
        const original = state.setActive.bind(state)
        exits.set(id, [])
        vi.spyOn(state, 'setActive').mockImplementation((type, active, options) => {
            const animation = original(type, active, options)
            if (type !== 'exit' || !active) return animation
            const completion = Promise.withResolvers<void>()
            exits.get(id)!.push(completion)
            return animation.then(() => completion.promise)
        })
    }

    return {
        result,
        onExitComplete,
        /** Whether `id`'s exit animation was started. */
        exitStarted: (id: string) => (exits.get(id)?.length ?? 0) > 0,
        async update(next: Partial<Props & { outer: boolean }>) {
            current = { ...current, ...next }
            await result.rerender({ ...current, onExitComplete })
            await flushTimers()
        },
        async complete(id: string) {
            exits.get(id)?.[0]?.resolve()
            // The release chains through several promise and frame hops.
            for (let i = 0; i < 5; i++) await flushTimers()
        }
    }
}

/**
 * Upstream `AnimatePresence` `propagate` (`AnimatePresence/index.tsx` @
 * v14.7.1, lines 58, 70-71, 95-99, 213-217, 246; `use-presence.ts:40-65`).
 */
describe('AnimatePresence propagate', () => {
    // jsdom has no WAAPI; the clone path's style polling calls it.
    const proto = Element.prototype as unknown as { getAnimations?: () => Animation[] }
    const originalGetAnimations = proto.getAnimations

    beforeEach(() => {
        vi.clearAllMocks()
        proto.getAnimations = () => []
        vi.useFakeTimers()
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            setTimeout(() => cb(0), 0)
            return 0 as unknown as number
        })
    })

    afterEach(async () => {
        // Unmount, then let motion-dom's frameloop finish its pending frame on
        // the fake clock. Reinstalling fake timers (or going back to real
        // ones) drops a pending frame, and the frameloop never runs again.
        cleanup()
        await vi.advanceTimersByTimeAsync(100)
        vi.unstubAllGlobals()
        proto.getAnimations = originalGetAnimations
    })

    it.each(['owned', 'legacy'] as const)(
        '%s nested boundary with propagate exits its children with the parent',
        async (form) => {
            const group = await mountGroup({ form, propagate: true })

            await group.update({ outer: false })
            expect(group.exitStarted('inner')).toBe(true)

            await group.complete('outer')
            expect(group.onExitComplete).not.toHaveBeenCalled()

            await group.complete('inner')
            expect(group.onExitComplete).toHaveBeenCalledTimes(1)
            expect(group.result.queryByTestId('outer')).toBeNull()
        }
    )

    it.each(['owned', 'legacy'] as const)(
        '%s nested boundary without propagate is independent of the parent exit',
        async (form) => {
            const group = await mountGroup({ form, propagate: false })

            await group.update({ outer: false })
            expect(group.exitStarted('inner')).toBe(false)

            await group.complete('outer')
            expect(group.exitStarted('inner')).toBe(false)
            expect(group.onExitComplete).toHaveBeenCalledTimes(1)
            expect(group.result.queryByTestId('outer')).toBeNull()
        }
    )

    it("legacy nested boundary without propagate runs its own children's exits", async () => {
        const group = await mountGroup({ form: 'legacy', propagate: false })

        await group.update({ innerShown: false })
        // The (mocked, instant) exit animation ran on an exit clone.
        const { animate } = await import('motion')
        const animated = vi.mocked(animate).mock.calls.map(([target]) => target)
        expect(
            animated.some(
                (target) => target instanceof HTMLElement && target.dataset.clone === 'true'
            )
        ).toBe(true)
    })

    it('legacy nested boundary with propagate leaves no clone behind', async () => {
        const group = await mountGroup({ form: 'legacy', propagate: true })
        const { animate } = await import('motion')
        const cloneExits = () =>
            vi
                .mocked(animate)
                .mock.calls.filter(
                    ([target]) => target instanceof HTMLElement && target.dataset.clone === 'true'
                ).length

        // The child is removed while it is already exiting with its parent:
        // it must not also get a clone exit from its own boundary.
        await group.update({ outer: false })
        expect(group.exitStarted('inner')).toBe(true)
        await group.update({ innerShown: false })
        expect(cloneExits()).toBe(0)

        await group.complete('outer')
        expect(group.onExitComplete).toHaveBeenCalledTimes(1)
        expect(group.result.queryByTestId('outer')).toBeNull()
        expect(group.result.container.querySelector('[data-clone="true"]')).toBeNull()
        expect(cloneExits()).toBe(0)
    })

    it('empty nested boundary with propagate releases the parent exit', async () => {
        const group = await mountGroup({ form: 'empty', propagate: true })

        await group.update({ outer: false })
        await group.complete('outer')

        expect(group.onExitComplete).toHaveBeenCalledTimes(1)
        expect(group.result.queryByTestId('outer')).toBeNull()
    })

    it('legacy nested boundary with propagate, emptied before the parent exits, releases it', async () => {
        const group = await mountGroup({ form: 'legacy', propagate: true })

        await group.update({ innerShown: false })
        await group.update({ outer: false })
        await group.complete('outer')

        expect(group.onExitComplete).toHaveBeenCalledTimes(1)
        expect(group.result.queryByTestId('outer')).toBeNull()
    })
})
