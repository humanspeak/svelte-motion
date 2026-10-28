import { render } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { tick } from 'svelte'
import { describe, expect, it } from 'vitest'

import LayoutOptionsHarness from './LayoutOptionsHarness.svelte'

/**
 * Plan 007 (Motion 14.7.1, #1935): `layoutRoot` and `layoutAnchor` are
 * projection props, not DOM attributes. `layoutRoot` is read when the element
 * mounts (upstream `use-visual-element.ts:229-248 @ v14.7.1`), and
 * `layoutAnchor` follows every update (upstream `MeasureLayout.tsx`
 * `layoutOptions`, 43-52 @ v14.7.1).
 */
const frames = async (count: number) => {
    for (let i = 0; i < count; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    await tick()
}

const element = () => document.getElementById('layout-options') as HTMLElement
const getOptions = () => visualElementStore.get(element())!.projection!.options

describe('layoutRoot and layoutAnchor props (#1935)', () => {
    it('does not render either prop as a DOM attribute', async () => {
        render(LayoutOptionsHarness, {
            props: { layoutRoot: true, layoutAnchor: { x: 0.5, y: 0.5 } }
        })
        await frames(1)
        for (const name of ['layoutroot', 'layoutRoot', 'layoutanchor', 'layoutAnchor']) {
            expect(element().hasAttribute(name)).toBe(false)
        }
    })

    it('passes both to the projection node', async () => {
        render(LayoutOptionsHarness, {
            props: { layoutRoot: true, layoutAnchor: { x: 0.5, y: 0.5 } }
        })
        await frames(1)
        expect(getOptions().layoutRoot).toBe(true)
        expect(getOptions().layoutAnchor).toEqual({ x: 0.5, y: 0.5 })
    })

    it('keeps layoutAnchor in sync after mount', async () => {
        const { rerender } = render(LayoutOptionsHarness, {
            props: { layoutRoot: true, layoutAnchor: { x: 0, y: 0 } }
        })
        await frames(1)
        expect(getOptions().layoutAnchor).toEqual({ x: 0, y: 0 })

        await rerender({ layoutRoot: true, layoutAnchor: { x: 1, y: 1 } })
        await tick()
        expect(getOptions().layoutAnchor).toEqual({ x: 1, y: 1 })

        await rerender({ layoutRoot: true, layoutAnchor: false })
        await tick()
        expect(getOptions().layoutAnchor).toBe(false)
    })

    it('reads layoutRoot only at mount, as upstream', async () => {
        const { rerender } = render(LayoutOptionsHarness, {
            props: { layoutRoot: true, layoutAnchor: { x: 0, y: 0 } }
        })
        await frames(1)
        await rerender({ layoutRoot: false, layoutAnchor: { x: 0, y: 0 } })
        await tick()
        expect(getOptions().layoutRoot).toBe(true)
    })
})
