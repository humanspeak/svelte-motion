import { mount, unmount } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import AnimateViewProbe from './__tests__/AnimateViewProbe.svelte'
import { animateView } from './animateView'

// jsdom has no document.startViewTransition, so these tests exercise
// motion-dom's documented fallback: `update` still runs and the builder
// resolves. That fallback is exactly what non-supporting browsers get,
// so it's a real contract, not a mock.
describe('animateView', () => {
    it('runs the update and resolves without View Transition support', async () => {
        const update = vi.fn()
        await animateView(update)
        expect(update).toHaveBeenCalledTimes(1)
    })

    it('awaits an async update before resolving', async () => {
        const order: string[] = []
        // Microtask-based delay — the suite's global fake timers would
        // never fire a real setTimeout, and a hung update blocks
        // motion-dom's global view-transition queue for the whole file.
        await animateView(async () => {
            order.push('update-start')
            await Promise.resolve()
            order.push('update-end')
        })
        order.push('resolved')
        expect(order).toEqual(['update-start', 'update-end', 'resolved'])
    })

    it('propagates a throwing update as a rejection', async () => {
        await expect(
            animateView(() => {
                throw new Error('boom')
            })
        ).rejects.toThrow('boom')
    })

    it('returns the chainable builder', async () => {
        const el = document.createElement('div')
        document.body.appendChild(el)
        const builder = animateView(() => {})
            .add(el)
            .layout({ duration: 0.2 })
            .enter({ opacity: [0, 1] })
            .exit({ opacity: 0 })
            .new({ x: 0 })
            .old({ x: 10 })
            .crop(false)
            .group(false)
            .class('hero')
        expect(typeof builder.then).toBe('function')
        await builder
        el.remove()
    })

    it('flushes Svelte state to the DOM inside the update', async () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const component = mount(AnimateViewProbe, { target: host })

        expect(host.querySelector('[data-testid="view-probe"]')?.textContent).toBe('a')
        let textDuringUpdate: string | undefined
        await animateView(() => {
            component.swap()
            // flushSync runs after this callback returns, inside the
            // wrapper — capture on the microtask right after.
        }).then(() => {
            textDuringUpdate = host.querySelector('[data-testid="view-probe"]')?.textContent
        })
        expect(textDuringUpdate).toBe('b')

        // Svelte's `unmount()` returns a Promise that only settles after outro
        // transitions; the test tears down synchronously and never awaits it.
        void unmount(component)
        host.remove()
    })
})
