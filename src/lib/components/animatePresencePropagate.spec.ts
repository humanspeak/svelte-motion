import { flushTimers } from '$lib/__tests__/flushTimers'
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Clone exits resolve at once (as in `src/lib/html/_MotionContainer.spec.ts`);
// real-node exits are held by the spies in `mountGroup`.
vi.mock('motion', () => ({
    animate: vi.fn(() => ({ finished: Promise.resolve() }))
}))

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
    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            setTimeout(() => cb(0), 0)
            return 0 as unknown as number
        })
    })

    afterEach(() => {
        // Unmount while the fake timers are still installed, so no held exit
        // leaks into the next case. Like `_MotionContainer.spec.ts`, never go
        // back to real timers mid-file: that drops motion-dom's pending frame
        // and its frameloop never runs again.
        cleanup()
        vi.runOnlyPendingTimers()
        vi.unstubAllGlobals()
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
        expect(group.result.container.querySelector('[data-clone="true"]')).not.toBeNull()
    })

    it('legacy nested boundary with propagate leaves no clone behind', async () => {
        const group = await mountGroup({ form: 'legacy', propagate: true })

        await group.update({ outer: false })
        await group.complete('outer')
        await group.complete('inner')
        await flushTimers()

        expect(group.result.queryByTestId('outer')).toBeNull()
        expect(group.result.container.querySelector('[data-clone="true"]')).toBeNull()
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
