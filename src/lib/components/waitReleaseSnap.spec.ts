import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WaitReleaseHarness from './__tests__/WaitReleaseHarness.svelte'

// Clone exits finish 100ms after they start (see presenceSiblingSnapshots.spec.ts).
vi.mock('motion', () => ({
    animate: vi.fn(() => ({
        finished: new Promise((resolve) => setTimeout(resolve, 100)),
        stop() {}
    }))
}))

/**
 * Plan 015b A2.1: a wait-mode swap's release of its held parent follows the
 * B(c) rule. The exit's completion re-renders only its `AnimatePresence`
 * (`AnimatePresence/index.tsx:244` @ v14.7.1, `use-presence.ts:40-43`), so a
 * held parent outside it, in no shared `LayoutGroup`, snaps (refreshes
 * silently) instead of running the release FLIP; inside a shared
 * `LayoutGroup` it still animates. The framer-motion 14.7.1 ModeButton mirror
 * keeps the label centred in every frame without a group.
 *
 * jsdom has no layout: `#held` is 51px wide with the copy label, 67px with
 * the copied one, or its inline (held) width while a hold is on.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function layOut(element: HTMLElement): DOMRect {
    let width = 0
    if (element.id === 'held') {
        const inline = Number.parseFloat(element.style.width)
        const copied = element.querySelector(
            '#label-copied:not([data-presence-wait-hidden]):not([data-clone])'
        )
        width = Number.isFinite(inline) && inline > 0 ? inline : copied ? 67 : 51
    } else if (element.id.startsWith('label-')) {
        width = element.id === 'label-copied' ? 67 : 51
    }
    return {
        x: 100 - width / 2,
        y: 10,
        left: 100 - width / 2,
        top: 10,
        width,
        height: 16,
        right: 100 + width / 2,
        bottom: 26,
        toJSON() {}
    }
}

describe('wait-mode release of a held parent (plan 015b A2.1)', () => {
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
        HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
            return layOut(this)
        }
        ;(Element.prototype as unknown as { getAnimations: () => Animation[] }).getAnimations =
            () => []
    })
    afterEach(() => {
        delete (HTMLElement.prototype as Partial<HTMLElement>).getBoundingClientRect
        delete (Element.prototype as Partial<Element>).getAnimations
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    const commitsOfHeld = () => {
        const commits: string[] = []
        const commit = Object.getOwnPropertyDescriptor(
            MotionDomProjectionAdapter.prototype,
            'commitObservedLayoutChange'
        )!.value as (this: MotionDomProjectionAdapter, ...args: unknown[]) => void
        vi.spyOn(
            MotionDomProjectionAdapter.prototype,
            'commitObservedLayoutChange'
        ).mockImplementation(function (this: MotionDomProjectionAdapter, ...args: unknown[]) {
            const element = (this as unknown as { element: HTMLElement | null }).element
            if (element?.id === 'held') commits.push('held')
            return commit.apply(this, args)
        })
        return commits
    }

    for (const layoutGroup of [false, true]) {
        it(`${layoutGroup ? 'in a LayoutGroup the release animates' : 'with no LayoutGroup the held parent snaps'}`, async () => {
            const { rerender } = render(WaitReleaseHarness, { props: { layoutGroup } })
            await sleep(150)
            await tick()
            const commits = commitsOfHeld()

            await rerender({ copied: true, layoutGroup })
            await sleep(400)
            await tick()

            expect(document.getElementById('label-copied')).not.toBeNull()
            expect(document.querySelector('[data-clone]')).toBeNull()
            expect(document.getElementById('held')!.style.width).toBe('')
            if (layoutGroup) expect(commits.length).toBeGreaterThan(0)
            else expect(commits).toEqual([])
        })
    }
})
