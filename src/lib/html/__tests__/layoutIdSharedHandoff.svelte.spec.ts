import { layoutIdRegistry } from '$lib/utils/layoutId'
import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { render } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LayoutIdHandoffHarness from './LayoutIdHandoffHarness.svelte'

/**
 * Plan 007 amendment A1 (#1935): when the departing `layoutId` lead's own
 * snapshot reaches the arriving node through `promote()` (a shared
 * snapshot, upstream's data flow), motion-dom animates the handoff itself.
 * The registry entry is then only dropped, as
 * `consumeLayoutIdHandoffAfterSwitch` already does, so the change doesn't
 * animate twice. `layout="position"`/`"size"` elements get the handoff too.
 */
const frames = async (count: number) => {
    for (let i = 0; i < count; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    await tick()
}

const boxes: Record<string, [number, number, number, number]> = {
    a: [0, 0, 100, 50],
    b: [300, 0, 100, 50]
}

describe('layoutId shared-snapshot handoff (#1935 A1)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
        // A detached element reads as an all-zero box, like a browser.
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            const [x, y, width, height] = (this.isConnected && boxes[this.id]) || [0, 0, 0, 0]
            return new DOMRect(x, y, width, height)
        })
        layoutIdRegistry.consume('a1-handoff')
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    for (const layout of [undefined, 'position'] as const) {
        it(`animates once from the departing lead and drops the registry entry (layout ${layout})`, async () => {
            const { rerender } = render(LayoutIdHandoffHarness, {
                props: { selected: 'a', layout }
            })
            await frames(3)
            const commit = vi.spyOn(
                MotionDomProjectionAdapter.prototype,
                'commitObservedLayoutChange'
            )

            await rerender({ selected: 'b', layout })
            await frames(2)

            const node = visualElementStore.get(document.getElementById('b')!)!.projection!
            // No registry commit on top of motion-dom's own resume.
            expect(commit.mock.calls.filter(([rect]) => rect !== undefined)).toHaveLength(0)
            expect(layoutIdRegistry.has('a1-handoff')).toBe(false)
            // It animates from the old slot.
            expect(node.currentAnimation).toBeDefined()
        })
    }
})
