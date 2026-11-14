import { flushTimers } from '$lib/__tests__/flushTimers'
import { render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { motion } from '../index.js'

// Motion 14.14.0 `fx` prop. Upstream
// `packages/framer-motion/src/motion/__tests__/fx-prop.test.tsx` @ v14.14.0:
// `<motion.div fx />` renders `fx=""`, and `fx={false}` renders no attribute.
// Upstream `packages/framer-motion/src/render/dom/utils/filter-props.ts:32-39`
// @ v14.14.0 tests `props.fx` for truthiness and writes an empty string, so
// any truthy value renders an empty attribute and anything else renders none.

beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0)
        return 0 as unknown as number
    })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('fx prop (upstream fx-prop.test.tsx)', () => {
    it('fx renders as an empty attribute', async () => {
        const { container } = render(motion.div, { props: { fx: true } })
        await flushTimers()
        expect(container.querySelector('div[fx]')!.getAttribute('fx')).toBe('')
    })

    it('fx={false} renders no attribute', async () => {
        const { container, rerender } = render(motion.div, { props: { fx: true } })
        await flushTimers()
        await rerender({ fx: false })
        await flushTimers()
        expect(container.querySelector('[fx]')).toBeNull()
    })

    it('fx can be turned back on', async () => {
        const { container, rerender } = render(motion.div, { props: { fx: true } })
        await flushTimers()
        await rerender({ fx: false })
        await flushTimers()
        await rerender({ fx: true })
        await flushTimers()
        expect(container.querySelector('div[fx]')!.getAttribute('fx')).toBe('')
    })

    it('no fx prop renders no attribute', async () => {
        const { container } = render(motion.div)
        await flushTimers()
        expect(container.querySelector('[fx]')).toBeNull()
    })

    it('a truthy non-boolean still renders an empty attribute', async () => {
        const { container } = render(motion.div, { props: { fx: 'yes' as never } })
        await flushTimers()
        expect(container.querySelector('div[fx]')!.getAttribute('fx')).toBe('')
    })
})
