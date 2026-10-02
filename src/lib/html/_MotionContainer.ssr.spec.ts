import { render } from '@testing-library/svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import MotionContainer from './_MotionContainer.svelte'

describe('_MotionContainer SSR styles', () => {
    beforeEach(() => {
        window.MotionIsMounted = false
        window.MotionHasOptimisedAnimation = undefined
        window.MotionHandoffMarkAsComplete = undefined
        window.MotionHandoffIsComplete = undefined
        window.MotionCancelOptimisedAnimation = undefined
        window.__SvelteMotionAppear = undefined
    })

    it('reflects initial styles in SSR output (opacity/borderRadius)', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { opacity: 0.3, borderRadius: '12px' },
                style: 'width: 100px; height: 50px'
            }
        })
        const el = container.firstElementChild as HTMLElement
        const style = el.getAttribute('style') ?? ''
        expect(style).toMatch(/width: 100px/)
        expect(style).toMatch(/height: 50px/)
        expect(style).toMatch(/opacity: 0.3/)
        expect(style).toMatch(/border-radius: 12px/)
    })

    // Upstream parity: framer-motion `makeLatestValues` (use-visual-state.ts) seeds only
    // from `initial`, or from `animate` when the initial animation is blocked
    // (`initial={false}`). An empty `initial` therefore renders nothing for animate keys.
    it('does not seed animate keyframes when initial is empty', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: {},
                animate: { scale: [2], opacity: [0.8] },
                style: 'width: 100px; height: 50px'
            }
        })
        const el = container.firstElementChild as HTMLElement
        const style = el.getAttribute('style') ?? ''
        expect(style).not.toMatch(/opacity:/)
        expect(style).not.toMatch(/transform:/)
    })

    it('does not seed a CSS variable from animate when initial is absent', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', animate: { '--x': 100 } }
        })
        expect(container.firstElementChild?.getAttribute('style') ?? '').not.toMatch(/--x/)
    })

    it('does not seed a transform from animate when initial is absent', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', animate: { x: 100 } }
        })
        expect(container.firstElementChild?.getAttribute('style') ?? '').not.toMatch(/transform/)
    })

    it('does not seed opacity keyframes from animate when initial is absent', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', animate: { opacity: [0, 1] } }
        })
        expect(container.firstElementChild?.getAttribute('style') ?? '').not.toMatch(/opacity/)
    })

    it('control: initial={false} renders the animate value', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', initial: false, animate: { opacity: 0.5 } }
        })
        expect(container.firstElementChild?.getAttribute('style') ?? '').toMatch(/opacity: 0.5/)
    })

    it('control: initial={false} renders the last animate keyframe', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', initial: false, animate: { opacity: [0.2, 0.7] } }
        })
        expect(container.firstElementChild?.getAttribute('style') ?? '').toMatch(/opacity: 0.7/)
    })

    it('control: own initial wins over animate', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', initial: { opacity: 0.3 }, animate: { opacity: 1 } }
        })
        expect(container.firstElementChild?.getAttribute('style') ?? '').toMatch(/opacity: 0.3/)
    })

    it('does not emit invalid styles for null/undefined initial props', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { opacity: undefined, borderRadius: undefined },
                style: 'width: 10px'
            }
        })
        const el = container.firstElementChild as HTMLElement
        const style = el.getAttribute('style') ?? ''
        expect(style).toContain('width: 10px')
        expect(style).not.toMatch(/opacity:/)
        expect(style).not.toMatch(/border-radius:/)
    })

    it('emits optimized appear handoff metadata for SSR enter animations', () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { opacity: 0, scale: 0.9 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.5 }
            }
        })
        const el = container.firstElementChild as HTMLElement
        expect(el.getAttribute('data-framer-appear-id')).toMatch(/^svelte-motion-/)
        expect(container.innerHTML).toContain('MotionHasOptimisedAnimation')
    })
})
