import { describe, expect, it, vi } from 'vitest'
import { createPresenceExitRegistry } from './presenceExitRegistry'

describe('presence exit registry', () => {
    it('waits for every participant and completes once', () => {
        const registry = createPresenceExitRegistry()
        registry.register(1)
        registry.register(2)
        const done = vi.fn()
        const complete = registry.begin(done)
        complete(1)
        complete(1)
        complete(99)
        expect(done).not.toHaveBeenCalled()
        complete(2)
        complete(2)
        expect(done).toHaveBeenCalledTimes(1)
    })

    it('holds an empty manual wrapper, including unknown mount completions', () => {
        const registry = createPresenceExitRegistry()
        const done = vi.fn()
        const complete = registry.begin(done)
        complete(1)
        expect(done).not.toHaveBeenCalled()
        const dispose = registry.register(1)
        expect(done).not.toHaveBeenCalled()
        dispose()
        dispose()
        expect(done).toHaveBeenCalledTimes(1)
    })

    it('waits for a participant registered during exit', () => {
        const registry = createPresenceExitRegistry()
        registry.register(1)
        const done = vi.fn()
        const complete = registry.begin(done)
        registry.register(2)
        complete(1)
        expect(done).not.toHaveBeenCalled()
        complete(2)
        expect(done).toHaveBeenCalledTimes(1)
    })

    it.each([true, false])(
        'reevaluates when a %s completed participant is disposed',
        (completed) => {
            const registry = createPresenceExitRegistry()
            const dispose = registry.register(1)
            registry.register(2)
            const done = vi.fn()
            const complete = registry.begin(done)
            if (completed) complete(1)
            dispose()
            dispose()
            complete(1)
            expect(done).not.toHaveBeenCalled()
            complete(2)
            expect(done).toHaveBeenCalledTimes(1)
        }
    )

    it('releases when the final pending participant is disposed', () => {
        const registry = createPresenceExitRegistry()
        registry.register(1)
        const dispose = registry.register(2)
        const done = vi.fn()
        const complete = registry.begin(done)
        complete(1)
        dispose()
        expect(done).toHaveBeenCalledTimes(1)
    })

    it('invalidates old callbacks across cancellation, new exits, and teardown', () => {
        const registry = createPresenceExitRegistry()
        const dispose = registry.register(1)
        const first = vi.fn()
        const oldComplete = registry.begin(first)
        registry.cancel()
        oldComplete(1)
        const second = vi.fn()
        const complete = registry.begin(second)
        oldComplete(1)
        expect(first).not.toHaveBeenCalled()
        expect(second).not.toHaveBeenCalled()
        registry.cancel()
        complete(1)
        dispose()
        expect(second).not.toHaveBeenCalled()
    })

    it('resets completed participants for another exit cycle', () => {
        const registry = createPresenceExitRegistry()
        registry.register(1)
        registry.register(2)
        const done = vi.fn()
        const first = registry.begin(done)
        first(1)
        const second = registry.begin(done)
        first(2)
        second(2)
        expect(done).not.toHaveBeenCalled()
        second(1)
        expect(done).toHaveBeenCalledTimes(1)
    })

    it('does not allow an old disposer to unregister a replacement', () => {
        const registry = createPresenceExitRegistry()
        const oldDispose = registry.register(1)
        registry.register(1)
        const done = vi.fn()
        const complete = registry.begin(done)
        oldDispose()
        expect(done).not.toHaveBeenCalled()
        complete(1)
        expect(done).toHaveBeenCalledTimes(1)
    })

    describe('popLayout element (#2503)', () => {
        type Registry = ReturnType<typeof createPresenceExitRegistry>
        const fakeNode = (parentRegister?: Registry['register']) =>
            ({
                current: document.createElement('div'),
                parent: parentRegister ? { presenceContext: { register: parentRegister } } : {}
            }) as never as { current: HTMLElement }

        it('keeps the outermost registered node', () => {
            const registry = createPresenceExitRegistry()
            expect(registry.getPopElement()).toBeUndefined()
            const outer = fakeNode()
            registry.register('outer', outer as never)
            expect(registry.getPopElement()).toBe(outer.current)
        })

        it('ignores an inner node whose parent shares this register', () => {
            const registry = createPresenceExitRegistry()
            const outer = fakeNode()
            const inner = fakeNode(registry.register)
            registry.register('outer', outer as never)
            registry.register('inner', inner as never)
            expect(registry.getPopElement()).toBe(outer.current)
        })

        it('keeps a node whose parent belongs to another presence child', () => {
            const registry = createPresenceExitRegistry()
            const other = createPresenceExitRegistry()
            const node = fakeNode(other.register)
            registry.register('node', node as never)
            expect(registry.getPopElement()).toBe(node.current)
        })

        it('clears the stored node when it unregisters', () => {
            const registry = createPresenceExitRegistry()
            const first = fakeNode()
            const second = fakeNode()
            const disposeFirst = registry.register('first', first as never)
            const disposeSecond = registry.register('second', second as never)
            // Unregistering a node that isn't stored leaves the stored one.
            disposeFirst()
            expect(registry.getPopElement()).toBe(second.current)
            disposeSecond()
            expect(registry.getPopElement()).toBeUndefined()
        })

        it('ignores registrations without a node', () => {
            const registry = createPresenceExitRegistry()
            registry.register('bare')
            expect(registry.getPopElement()).toBeUndefined()
        })
    })
})
