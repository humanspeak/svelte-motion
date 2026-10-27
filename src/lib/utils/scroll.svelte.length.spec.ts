import { frame, supportsFlags } from 'motion-dom'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScroll } from './scroll.svelte.js'

/**
 * Port of upstream's `useScroll scrollXLength/scrollYLength (#2189)` cases
 * (framer-motion `src/value/__tests__/use-scroll.test.tsx` @ v14.7.1, commits
 * `623a0e7b6` + `ff112788f`), driven by the **real** `scroll()` from `motion`
 * against mocked DOM sizes.
 *
 * Lives in its own file because `scroll.svelte.spec.ts` mocks `scroll()`;
 * these cases need motion's actual scroll info (including `scrollLength`).
 */

const mock = (element: Element, values: Record<string, number>) => {
    for (const [key, value] of Object.entries(values)) {
        Object.defineProperty(element, key, { value, configurable: true })
    }
}

/** Wait two motion-dom post-render passes so `scroll()` measures and notifies. */
const nextFrames = () =>
    new Promise<void>((resolve) => frame.postRender(() => frame.postRender(() => resolve())))

/** Drain motion-dom's microtask batcher so `useScroll` attaches `scroll()`. */
const drainMicrotasks = async (ticks = 4) => {
    for (let i = 0; i < ticks; i++) await Promise.resolve()
}

const containerSize = {
    clientWidth: 400,
    scrollWidth: 400,
    scrollLeft: 0,
    clientHeight: 500,
    scrollHeight: 3000,
    scrollTop: 500
}

describe('utils/scroll - useScroll scrollXLength/scrollYLength (#2189)', () => {
    let elements: Element[] = []
    let roots: VoidFunction[] = []

    beforeEach(() => {
        // The client test env installs fake timers, which freeze motion-dom's
        // frame loop (see vitest-setup-client.ts).
        vi.useRealTimers()
    })

    afterEach(() => {
        supportsFlags.scrollTimeline = undefined
        supportsFlags.viewTimeline = undefined
        for (const stop of roots) stop()
        for (const el of elements) el.remove()
        roots = []
        elements = []
    })

    const append = <T extends Element>(el: T): T => {
        document.body.appendChild(el)
        elements.push(el)
        return el
    }

    const mount = async (options: Parameters<typeof useScroll>[0]) => {
        let values: ReturnType<typeof useScroll> | undefined
        roots.push(
            $effect.root(() => {
                values = useScroll(options)
            })
        )
        flushSync()
        await drainMicrotasks()
        await nextFrames()
        return values!
    }

    it("exposes each axis's maximum scroll offset", async () => {
        const container = append(document.createElement('div'))
        mock(container, {
            clientWidth: 400,
            scrollWidth: 1000,
            scrollLeft: 100,
            clientHeight: 500,
            scrollHeight: 3000,
            scrollTop: 500
        })

        const { scrollX, scrollY, scrollYProgress, scrollXLength, scrollYLength } = await mount({
            container
        })

        expect(scrollY.get()).toBe(500)
        expect(scrollYProgress.get()).toBe(0.2)
        expect(scrollYLength.get()).toBe(2500)

        expect(scrollX.get()).toBe(100)
        expect(scrollXLength.get()).toBe(600)

        // Distance from the end, as asked for in #2189
        expect(scrollYLength.get() - scrollY.get()).toBe(2000)
    })

    it("is the container's maximum scroll offset when tracking a target with an offset", async () => {
        const container = append(document.createElement('div'))
        container.style.position = 'relative'
        mock(container, { ...containerSize, scrollTop: 850 })
        const target = document.createElement('div')
        container.appendChild(target)
        mock(target, { offsetTop: 1000, offsetLeft: 0, clientWidth: 400, clientHeight: 200 })
        Object.defineProperty(target, 'offsetParent', { value: container, configurable: true })

        const { scrollY, scrollYProgress, scrollYLength } = await mount({
            container,
            target,
            offset: ['start end', 'end start']
        })

        // Progress follows the target: offsets resolve to 500 and 1200
        expect(scrollY.get()).toBe(850)
        expect(scrollYProgress.get()).toBe(0.5)
        expect(scrollYLength.get()).toBe(2500)
    })

    it('updates when the container resizes', async () => {
        const container = append(document.createElement('div'))
        mock(container, containerSize)

        const values = await mount({ container })
        expect(values.scrollYLength.get()).toBe(2500)

        mock(container, { clientHeight: 1000 })
        window.dispatchEvent(new Event('resize'))
        await nextFrames()

        expect(values.scrollYLength.get()).toBe(2000)
        expect(values.scrollYProgress.get()).toBe(0.25)
    })

    it('is set alongside accelerated progress values', async () => {
        supportsFlags.scrollTimeline = true
        const container = append(document.createElement('div'))
        mock(container, containerSize)

        const values = await mount({ container })

        expect(values.scrollYProgress.accelerate).toBeDefined()
        expect(values.scrollYLength.accelerate).toBeUndefined()
        expect(values.scrollYLength.get()).toBe(2500)
    })
})
