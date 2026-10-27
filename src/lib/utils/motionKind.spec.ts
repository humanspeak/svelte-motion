import Div from '$lib/html/Div.svelte'
import { render, screen } from '@testing-library/svelte'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    formatLazyStrictMessage,
    LAZY_STRICT_MESSAGE,
    MOTION_KIND_PROP,
    REORDER_STRICT_HINT,
    resetWarnOnceForTests,
    warnOnce,
    withMotionKind
} from './motionKind'

const MDiv = withMotionKind(Div, { [MOTION_KIND_PROP]: 'm' })

afterEach(() => {
    resetWarnOnceForTests()
    vi.restoreAllMocks()
})

describe('withMotionKind', () => {
    it('forwards prop changes made through rerender', async () => {
        const result = render(MDiv, { props: { class: 'a', 'data-testid': 'box' } })
        expect(screen.getByTestId('box').className).toContain('a')

        await result.rerender({ class: 'b' })
        expect(screen.getByTestId('box').className).toContain('b')
        expect(screen.getByTestId('box').className).not.toContain('a')
    })

    it('forwards spread props whose keys are added later', async () => {
        const result = render(MDiv, { props: { 'data-testid': 'box' } })
        expect(screen.getByTestId('box').hasAttribute('data-later')).toBe(false)

        await result.rerender({ 'data-later': 'yes' } as Record<string, unknown>)
        expect(screen.getByTestId('box').getAttribute('data-later')).toBe('yes')
    })

    it('keeps bind:ref working through the wrapper', async () => {
        // A compiled `bind:ref` passes a getter/setter pair on the props object.
        let ref: HTMLElement | null | undefined
        const target = document.createElement('div')
        document.body.appendChild(target)
        const instance = mount(MDiv, {
            target,
            props: {
                'data-testid': 'bound',
                get ref() {
                    return ref
                },
                set ref(value) {
                    ref = value
                }
            }
        })
        flushSync()

        expect(ref).toBe(target.querySelector('[data-testid="bound"]'))
        await unmount(instance)
        target.remove()
    })

    it('never renders the injected kind prop as a DOM attribute', () => {
        render(MDiv, { props: { 'data-testid': 'box' } })
        const box = screen.getByTestId('box')

        expect(box.hasAttribute(MOTION_KIND_PROP)).toBe(false)
        expect(box.outerHTML).not.toContain(MOTION_KIND_PROP)
    })

    it('reports injected keys through every Proxy trap', () => {
        let received: Record<PropertyKey, unknown> | undefined
        const Probe = (_anchor: unknown, props: Record<PropertyKey, unknown>) => {
            received = props
        }
        const original: Record<PropertyKey, unknown> = { a: 1 }
        withMotionKind(Probe, { [MOTION_KIND_PROP]: 'm' })(null, original)
        const props = received!

        expect(props[MOTION_KIND_PROP]).toBe('m')
        expect(MOTION_KIND_PROP in props).toBe(true)
        expect(Object.keys(props)).toEqual(['a', MOTION_KIND_PROP])
        expect({ ...props }).toEqual({ a: 1, [MOTION_KIND_PROP]: 'm' })
        expect(Object.getOwnPropertyDescriptor(props, MOTION_KIND_PROP)).toMatchObject({
            value: 'm',
            enumerable: true,
            configurable: true
        })

        props.b = 2
        expect(original.b).toBe(2)
        delete props.a
        expect('a' in original).toBe(false)
        // Callers can't override or remove the injected kind.
        props[MOTION_KIND_PROP] = 'motion'
        delete props[MOTION_KIND_PROP]
        expect(props[MOTION_KIND_PROP]).toBe('m')
        expect(MOTION_KIND_PROP in original).toBe(false)
    })
})

describe('strict-mode messages', () => {
    it('match upstream wording and troubleshooting link', () => {
        expect(formatLazyStrictMessage(LAZY_STRICT_MESSAGE)).toBe(
            'You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead. For more information and steps for solving, visit https://motion.dev/troubleshooting/lazy-strict-mode'
        )
        expect(formatLazyStrictMessage(LAZY_STRICT_MESSAGE + REORDER_STRICT_HINT)).toContain(
            'instead. For Reorder, import it from "@humanspeak/svelte-motion/m". For more information'
        )
    })
})

describe('warnOnce', () => {
    it('warns once per message, and again after a reset', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        warnOnce('first')
        warnOnce('first')
        warnOnce('second')
        expect(warn.mock.calls).toEqual([['first'], ['second']])

        resetWarnOnceForTests()
        warnOnce('first')
        expect(warn).toHaveBeenCalledTimes(3)
    })
})
