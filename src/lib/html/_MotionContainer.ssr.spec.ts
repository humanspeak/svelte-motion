import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import MotionContainer from './_MotionContainer.svelte'

describe('_MotionContainer SSR styles', () => {
    it('reflects initial styles in SSR output (opacity/borderRadius)', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
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

    it('falls back to first animate keyframe when initial is empty', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
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
        expect(style).toMatch(/opacity: 0.8/)
        // Transform string should contain scale(2)
        expect(style).toMatch(/transform: .*scale\(2\)/)
    })

    it('does not emit invalid styles for null/undefined initial props', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
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
})
