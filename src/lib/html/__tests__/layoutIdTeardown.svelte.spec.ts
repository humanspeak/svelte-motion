import { layoutIdRegistry } from '$lib/utils/layoutId'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LayoutIdTeardownHarness from './LayoutIdTeardownHarness.svelte'

const frames = async (count: number) => {
    for (let i = 0; i < count; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    await tick()
}

/**
 * Plan 008 Step 1: pin Svelte's teardown ordering for a `layoutId` element.
 *
 * Svelte 5's `destroy_effect` removes a block's DOM (`remove_effect_dom`)
 * BEFORE it runs the child effect teardowns (`destroy_effect_children` →
 * `execute_effect_teardown`). A `layoutId` element therefore cannot measure
 * itself in its cleanup: the handoff rect has to come from state captured
 * while it was still mounted. If Svelte ever flips this order, the simplest
 * correct capture is a single measurement in cleanup.
 */
describe('layoutId teardown ordering (plan 008)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        // The registry is a module singleton: drop a previous test's handoff
        // so this mount doesn't animate in from it.
        layoutIdRegistry.consume('teardown-probe')
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('runs $effect cleanups after the {#if} block DOM is already detached', async () => {
        const teardowns: Array<boolean | undefined> = []
        const { rerender } = render(LayoutIdTeardownHarness, {
            props: { show: true, onTeardown: (connected) => teardowns.push(connected) }
        })
        await frames(3)
        teardowns.length = 0

        await rerender({ show: false, onTeardown: (connected) => teardowns.push(connected) })
        await frames(1)

        expect(teardowns).toEqual([false])
    })

    it('hands off the pre-removal rect from cleanup without reading the DOM, and never reads while idle', async () => {
        // Every element lays out at (20, 40) 100×50 while attached; a
        // detached element reads as an all-zero box, like a browser.
        const reads = vi
            .spyOn(Element.prototype, 'getBoundingClientRect')
            .mockImplementation(function (this: Element) {
                return this.isConnected ? new DOMRect(20, 40, 100, 50) : new DOMRect()
            })
        const probe: { element?: HTMLElement } = {}
        const atSnapshot: Array<{ connected: boolean; readsSoFar: number }> = []
        const snapshot = vi.spyOn(layoutIdRegistry, 'snapshot').mockImplementation(() => {
            atSnapshot.push({
                connected: !!probe.element?.isConnected,
                readsSoFar: reads.mock.calls.length
            })
        })
        const { container, rerender } = render(LayoutIdTeardownHarness, { props: { show: true } })
        await frames(3)
        probe.element = container.querySelector<HTMLElement>('div') ?? undefined
        expect(probe.element).toBeTruthy()

        reads.mockClear()
        await frames(3)
        // Idle: nothing changed, so nothing is measured (upstream measures a
        // layoutId node only when an update touches it).
        expect(reads).not.toHaveBeenCalled()

        await rerender({ show: false })
        await frames(1)

        expect(snapshot).toHaveBeenCalledTimes(1)
        const [id, rect] = snapshot.mock.calls[0]
        expect(id).toBe('teardown-probe')
        // The last on-screen rect from while it was attached, not a
        // measurement of the detached element.
        expect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }).toEqual({
            left: 20,
            top: 40,
            width: 100,
            height: 50
        })
        // Already detached when the cleanup ran, and nothing was read by then.
        expect(atSnapshot).toEqual([{ connected: false, readsSoFar: 0 }])
    })
})
