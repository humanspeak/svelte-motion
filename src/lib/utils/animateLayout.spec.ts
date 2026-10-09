import { animateLayout as coreAnimateLayout, LayoutAnimationBuilder } from 'motion-dom'
import { mount, unmount } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import AnimateLayoutProbe from './__tests__/AnimateLayoutProbe.svelte'
import { animateLayout } from './animateLayout'

// Pass motion-dom's animateLayout through a spy so the tests run the real
// builder while still being able to reach the update callback it receives.
vi.mock('motion-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('motion-dom')>()
    return { ...actual, animateLayout: vi.fn(actual.animateLayout) }
})

// The update callback our wrapper handed to motion-dom on the latest call.
const receivedUpdate = (): (() => void | Promise<void>) =>
    vi
        .mocked(coreAnimateLayout)
        .mock.lastCall!.find((arg) => typeof arg === 'function') as () => void | Promise<void>

describe('animateLayout', () => {
    it('is exported from the package entry', async () => {
        const entry = await import('$lib')
        expect(entry.animateLayout).toBe(animateLayout)
    })

    it('runs the update and resolves to the layout animation', async () => {
        const element = document.createElement('div')
        element.setAttribute('data-layout', '')
        document.body.appendChild(element)

        const update = vi.fn(() => {
            element.style.width = '100px'
        })
        const builder = animateLayout(update, { duration: 0.1 })
        expect(builder).toBeInstanceOf(LayoutAnimationBuilder)

        const animation = await builder
        expect(update).toHaveBeenCalledTimes(1)
        expect(element.style.width).toBe('100px')
        expect(typeof animation.stop).toBe('function')
        element.remove()
    })

    it('accepts a scope before the update', async () => {
        const scope = document.createElement('div')
        document.body.appendChild(scope)

        const update = vi.fn()
        await animateLayout(scope, update, { duration: 0.1 })
        expect(update).toHaveBeenCalledTimes(1)
        scope.remove()
    })

    it('awaits an async update before resolving', async () => {
        const order: string[] = []
        await animateLayout(async () => {
            order.push('update-start')
            await Promise.resolve()
            order.push('update-end')
        })
        order.push('resolved')
        expect(order).toEqual(['update-start', 'update-end', 'resolved'])
    })

    it('flushes Svelte state to the DOM before the update returns', async () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const component = mount(AnimateLayoutProbe, { target: host })
        const probe = () => host.querySelector('[data-testid="layout-probe"]')

        const builder = animateLayout(() => component.expand())
        // motion-dom measures the new layout as soon as the update returns,
        // so the state change must already be in the DOM at that point.
        // Called synchronously: no microtask may run before the check, or
        // Svelte's own scheduled flush would hide a missing flushSync.
        void receivedUpdate()()
        expect(probe()?.getAttribute('data-expanded')).toBe('true')
        await builder

        void unmount(component)
        host.remove()
    })

    it('flushes Svelte state after an async update settles', async () => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const component = mount(AnimateLayoutProbe, { target: host })
        const probe = () => host.querySelector('[data-testid="layout-probe"]')

        const builder = animateLayout(async () => {
            await Promise.resolve()
            component.expand()
        })
        await receivedUpdate()()
        expect(probe()?.getAttribute('data-expanded')).toBe('true')
        await builder

        void unmount(component)
        host.remove()
    })
})
