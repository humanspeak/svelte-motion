import { describe, expect, it } from 'vitest'
import { mergeInlineStyles } from './style.js'

describe('mergeInlineStyles', () => {
    it('returns existing style when no initial/animate provided', () => {
        const out = mergeInlineStyles('color: red; width: 10px', null, null)
        expect(out).toContain('color: red')
        expect(out).toContain('width: 10px')
    })

    it('merges initial scalar props into style (opacity, backgroundColor, borderRadius)', () => {
        const out = mergeInlineStyles(
            '',
            { opacity: 0.5, backgroundColor: 'pink', borderRadius: '10px' },
            null
        )
        expect(out).toContain('opacity: 0.5')
        expect(out).toContain('background-color: pink')
        expect(out).toContain('border-radius: 10px')
    })

    it('adds px for width/height numbers', () => {
        const out = mergeInlineStyles('', { width: 100, height: 50 }, null)
        expect(out).toContain('width: 100px')
        expect(out).toContain('height: 50px')
    })

    it('composes transform for scale/rotate (number -> deg)', () => {
        const out = mergeInlineStyles('', { scale: 1.2, rotate: 45 }, null)
        expect(out).toContain('transform: scale(1.2) rotate(45deg)')
    })

    it('uses first element of keyframe arrays', () => {
        const out = mergeInlineStyles('', { borderRadius: ['20px'], rotate: [90] }, null)
        expect(out).toContain('border-radius: 20px')
        expect(out).toContain('rotate(90deg)')
    })

    it('falls back to animate first keyframe when initial is empty', () => {
        const out = mergeInlineStyles('', {}, { opacity: [0], scale: [2] })
        expect(out).toContain('opacity: 0')
        expect(out).toContain('scale(2)')
    })

    it('preserves existing declarations while adding new ones', () => {
        const out = mergeInlineStyles('color: red; width: 10px', { opacity: 1 }, null)
        expect(out).toContain('color: red')
        expect(out).toContain('width: 10px')
        expect(out).toContain('opacity: 1')
    })

    it('ignores null/undefined values and unknown complex keys', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const out = mergeInlineStyles('', { opacity: undefined, fooBarBaz: { x: 1 } as any }, null)
        expect(out).not.toContain('opacity')
        expect(out).not.toContain('foo-bar-baz')
    })

    it('handles empty arrays gracefully (no style written)', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const out = mergeInlineStyles('', { rotate: [] as any }, null)
        expect(out).not.toContain('transform')
    })

    it('rotate uses unit from string values and avoids adding deg', () => {
        const out = mergeInlineStyles('', { rotate: '1turn' }, null)
        expect(out).toContain('rotate(1turn)')
    })

    it('maps unknown flat keys to kebab-case CSS props', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const out = mergeInlineStyles('', { backgroundSize: 'cover' } as any, null)
        expect(out).toContain('background-size: cover')
    })

    it('supports width/height string values without adding px', () => {
        const out = mergeInlineStyles('', { width: '50%', height: '10rem' }, null)
        expect(out).toContain('width: 50%')
        expect(out).toContain('height: 10rem')
    })

    it('does not set prop when first keyframe is undefined (setProp v==null)', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const out = mergeInlineStyles('', { opacity: [undefined as any] }, null)
        expect(out).not.toContain('opacity')
    })

    it('does not set width when null or [undefined] (setPx guards)', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const out1 = mergeInlineStyles('', { width: null as any }, null)
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const out2 = mergeInlineStyles('', { width: [undefined as any] as any }, null)
        expect(out1).not.toContain('width:')
        expect(out2).not.toContain('width:')
    })

    it('ignores transform when value is null (addTransform value==null)', () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const out = mergeInlineStyles('', { scale: null as any }, null)
        expect(out).not.toContain('transform')
    })

    it('ignores malformed existing style declarations', () => {
        const out = mergeInlineStyles('baddecl; color: blue', { opacity: 1 }, null)
        expect(out).toContain('color: blue')
        expect(out).toContain('opacity: 1')
        expect(out).not.toContain('baddecl')
    })

    describe('Transform shorthands', () => {
        it('converts x, y, z to translateX/Y/Z transforms', () => {
            const out = mergeInlineStyles('', { x: 100, y: -50, z: 20 }, null)
            expect(out).toContain('transform: translateX(100px) translateY(-50px) translateZ(20px)')
        })

        it('converts y to translateY and combines with scale', () => {
            const out = mergeInlineStyles('', { y: 60, scale: 0.8 }, null)
            expect(out).toContain('transform: translateY(60px) scale(0.8)')
        })

        it('handles scaleX and scaleY separately', () => {
            const out = mergeInlineStyles('', { scaleX: 0.5, scaleY: 1.5 }, null)
            expect(out).toContain('transform: scaleX(0.5) scaleY(1.5)')
        })

        it('converts rotateX, rotateY, rotateZ with deg units', () => {
            const out = mergeInlineStyles('', { rotateX: 45, rotateY: 90, rotateZ: 180 }, null)
            expect(out).toContain('rotateX(45deg)')
            expect(out).toContain('rotateY(90deg)')
            expect(out).toContain('rotateZ(180deg)')
        })

        it('converts skewX and skewY with deg units', () => {
            const out = mergeInlineStyles('', { skewX: 10, skewY: 20 }, null)
            expect(out).toContain('skewX(10deg)')
            expect(out).toContain('skewY(20deg)')
        })

        it('preserves string units for transform values', () => {
            const out = mergeInlineStyles('', { x: '50%', rotate: '1turn' }, null)
            expect(out).toContain('translateX(50%)')
            expect(out).toContain('rotate(1turn)')
        })

        it('combines multiple transforms in correct order', () => {
            const out = mergeInlineStyles(
                '',
                { x: 10, y: 20, scale: 1.5, rotate: 45, skewX: 5 },
                null
            )
            expect(out).toContain('transform:')
            expect(out).toContain('translateX(10px)')
            expect(out).toContain('translateY(20px)')
            expect(out).toContain('scale(1.5)')
            expect(out).toContain('rotate(45deg)')
            expect(out).toContain('skewX(5deg)')
        })
    })

    describe('Pointer and cursor properties', () => {
        it('converts pointerEvents to kebab-case', () => {
            const out = mergeInlineStyles('', { pointerEvents: 'none' }, null)
            expect(out).toContain('pointer-events: none')
        })

        it('handles cursor property', () => {
            const out = mergeInlineStyles('', { cursor: 'pointer' }, null)
            expect(out).toContain('cursor: pointer')
        })

        it('combines cursor and transforms together', () => {
            const out = mergeInlineStyles('', { cursor: 'pointer', y: 10, scale: 0.9 }, null)
            expect(out).toContain('cursor: pointer')
            expect(out).toContain('transform: translateY(10px) scale(0.9)')
        })
    })

    describe('Variants use case - notifications stack', () => {
        it('properly handles notification closed variant with y transform', () => {
            const out = mergeInlineStyles(
                'height: 60px; width: 280px; background-color: #f5f5f5',
                {},
                {
                    y: -76,
                    opacity: 0.6,
                    pointerEvents: 'none',
                    cursor: 'default',
                    scale: 0.9
                }
            )
            expect(out).toContain('height: 60px')
            expect(out).toContain('width: 280px')
            expect(out).toContain('background-color: #f5f5f5')
            expect(out).toContain('opacity: 0.6')
            expect(out).toContain('pointer-events: none')
            expect(out).toContain('cursor: default')
            expect(out).toContain('transform: translateY(-76px) scale(0.9)')
        })

        it('properly handles header closed variant', () => {
            const out = mergeInlineStyles(
                'position: absolute',
                {},
                {
                    y: 60,
                    scale: 0.8,
                    opacity: 0,
                    pointerEvents: 'none'
                }
            )
            expect(out).toContain('position: absolute')
            expect(out).toContain('opacity: 0')
            expect(out).toContain('pointer-events: none')
            expect(out).toContain('transform: translateY(60px) scale(0.8)')
        })
    })
})
