import { render } from '@testing-library/svelte'
import type { MotionScope } from 'motion-dom'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, delay, hover, scopeMotion, toMediaQuery } from '../index.js'
import ScopeMotionProbe from './__tests__/ScopeMotionProbe.svelte'
import { useScopeMotion, type MotionScopeAttachment } from './scopeMotion.svelte.js'

type Attachment = MotionScopeAttachment<HTMLUListElement>

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('utils/scopeMotion - useScopeMotion', () => {
    beforeEach(() => {
        // The client setup installs fake timers; motion-dom's frame loop
        // needs real ones (see vitest-setup-client.ts).
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
    })

    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('starts with current = null and does not throw outside a component', () => {
        const scope = useScopeMotion(() => {})
        expect(typeof scope).toBe('function')
        expect(scope.current).toBeNull()
    })

    it('runs setup once on attach, in an active scope rooted at the element', async () => {
        const outside = document.createElement('div')
        outside.className = 'item'
        document.body.appendChild(outside)

        const setup = vi.fn((s: MotionScope) => {
            expect(s.state).toBe('active')
            animate('.item', { opacity: 0.5 }, { duration: 0 })
        })
        let attachment: Attachment | undefined
        const { getByTestId } = render(ScopeMotionProbe, {
            setup,
            onScope: (s) => (attachment = s)
        })
        flushSync()

        expect(setup).toHaveBeenCalledTimes(1)
        expect(attachment!.current?.state).toBe('active')

        await sleep(60)
        expect(getByTestId('inside').style.opacity).toBe('0.5')
        expect(outside.style.opacity).toBe('')
    })

    it('cancels the scope on unmount and runs setup cleanup', () => {
        const cleanup = vi.fn()
        let attachment: Attachment | undefined
        const { unmount } = render(ScopeMotionProbe, {
            setup: () => cleanup,
            onScope: (s) => (attachment = s)
        })
        flushSync()
        const live = attachment!.current!
        expect(live.state).toBe('active')

        unmount()

        expect(live.state).toBe('cancelled')
        expect(attachment!.current).toBeNull()
        expect(cleanup).toHaveBeenCalledTimes(1)
    })

    it('stops animations and delays started in setup on unmount, restoring inline style', async () => {
        const delayed = vi.fn()
        let started: { time: number } | undefined
        const { unmount, getByTestId } = render(ScopeMotionProbe, {
            setup: () => {
                started = animate('.item', { opacity: 0 }, { duration: 10 })
                delay(delayed, 200)
            }
        })
        flushSync()
        const element = getByTestId('inside')

        await sleep(80)
        expect(element.style.opacity).not.toBe('')

        unmount()
        const timeAtStop = started!.time
        await sleep(300)

        expect(delayed).not.toHaveBeenCalled()
        expect(started!.time).toBe(timeAtStop)
        // `cancel()` restores the `style` attribute (none before the scope).
        expect(element.getAttribute('style')).toBeNull()
    })

    it('re-runs setup and cancels the old scope when a deps value changes', async () => {
        const setup = vi.fn()
        const cleanup = vi.fn()
        let attachment: Attachment | undefined
        const { rerender } = render(ScopeMotionProbe, {
            setup: () => {
                setup()
                return cleanup
            },
            dep: 1,
            useDeps: true,
            onScope: (s) => (attachment = s)
        })
        flushSync()
        const first = attachment!.current!
        expect(setup).toHaveBeenCalledTimes(1)

        await rerender({ dep: 2 })
        flushSync()

        expect(setup).toHaveBeenCalledTimes(2)
        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(first.state).toBe('cancelled')
        expect(attachment!.current).not.toBe(first)
        expect(attachment!.current?.state).toBe('active')
    })

    it('does not re-run setup when $state read inside setup changes', () => {
        const seen: number[] = []
        const { component } = render(ScopeMotionProbe, {
            setup: (_s: MotionScope, tracked: number) => {
                seen.push(tracked)
            }
        })
        flushSync()
        expect(seen).toEqual([0])

        component.bump()
        flushSync()
        component.bump()
        flushSync()

        expect(seen).toEqual([0])
    })

    it('collects work started through scope.current.bind() and run()', async () => {
        let attachment: Attachment | undefined
        let bound: { time: number } | undefined
        const { unmount, getByTestId } = render(ScopeMotionProbe, {
            setup: () => {},
            onScope: (s) => (attachment = s)
        })
        flushSync()
        const element = getByTestId('inside')

        const handler = attachment!.current!.bind(() => {
            bound = animate(element, { opacity: 0 }, { duration: 10 })
        })
        handler()
        const stopHover = attachment!.current!.run(() => hover(document.body, () => {}))
        expect(typeof stopHover).toBe('function')

        await sleep(80)
        expect(element.style.opacity).not.toBe('')

        unmount()
        const timeAtStop = bound!.time
        await sleep(100)

        expect(bound!.time).toBe(timeAtStop)
        expect(element.getAttribute('style')).toBeNull()
    })

    it('reports matchMedia conditions on scope.media', () => {
        const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
            (query: string) =>
                ({
                    matches: query === toMediaQuery('>=800'),
                    media: query,
                    onchange: null,
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn()
                }) as unknown as MediaQueryList
        )

        try {
            const media: Record<string, boolean>[] = []
            render(ScopeMotionProbe, {
                setup: (s: MotionScope) => {
                    media.push({ ...s.media })
                },
                options: { matchMedia: { desktop: '>=800', mobile: '<800' } }
            })
            flushSync()
            expect(media).toEqual([{ desktop: true, mobile: false }])
        } finally {
            matchMedia.mockRestore()
        }
    })

    it('re-exports vanilla scopeMotion and toMediaQuery', () => {
        expect(toMediaQuery('>=800 !touch')).toBe('(width >= 800px) and (not ((pointer: coarse)))')
        const scope = scopeMotion(() => {})
        expect(scope.state).toBe('active')
        scope.stop()
        expect(scope.state).toBe('stopped')
    })
})
