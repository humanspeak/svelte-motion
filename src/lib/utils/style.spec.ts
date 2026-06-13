import { motionValue } from 'motion-dom'
import { describe, expect, it, vi } from 'vitest'
import {
    applyMotionStyleEffect,
    collectMotionStyleValues,
    extractTransform,
    mergeInlineStyles,
    serializeMotionStyle
} from './style.js'

describe('mergeInlineStyles', () => {
    it('returns existing style when no initial/animate provided', () => {
        const out = mergeInlineStyles('color: red; width: 10px', null, null)
        expect(out).toContain('color: red')
        expect(out).toContain('width: 10px')
    })

    it('preserves existing transform when animate fallback is empty', () => {
        const out = mergeInlineStyles('transform: translateX(64px) rotate(12deg)', null, {})

        expect(out).toContain('transform: translateX(64px) rotate(12deg)')
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
        it('converts transformPerspective to an upstream-ordered perspective transform', () => {
            const out = mergeInlineStyles('', { x: '100px', transformPerspective: '200px' }, null)

            expect(out).toContain('transform: perspective(200px) translateX(100px)')
            expect(out).not.toContain('transform-perspective')
        })

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

        it('serializes identity transform values as none', () => {
            const out = mergeInlineStyles('', { x: 0, y: '0px', scale: 1, rotate: 0 }, null)

            expect(out).toContain('transform: none')
        })
    })

    describe('transformTemplate', () => {
        it('applies a template to generated transforms with unitized latest values', () => {
            const out = mergeInlineStyles(
                '',
                { x: 10, rotate: 45 },
                null,
                ({ x, rotate }, generated) => `translateY(${x}) rotateZ(${rotate}) ${generated}`
            )

            expect(out).toContain(
                'transform: translateY(10px) rotateZ(45deg) translateX(10px) rotate(45deg)'
            )
        })

        it('passes transformPerspective through the template as perspective', () => {
            const out = mergeInlineStyles(
                '',
                { x: '100px', transformPerspective: '200px' },
                null,
                ({ transformPerspective }, generated) =>
                    `${generated} translateZ(${transformPerspective})`
            )

            expect(out).toContain(
                'transform: perspective(200px) translateX(100px) translateZ(200px)'
            )
        })

        it('calls the template even without generated transforms', () => {
            const out = mergeInlineStyles('', { opacity: 0.5 }, null, (_latest, generated) =>
                `perspective(600px) ${generated}`.trim()
            )

            expect(out).toContain('opacity: 0.5')
            expect(out).toContain('transform: perspective(600px)')
        })

        it('calls the template when no style source exists', () => {
            const out = mergeInlineStyles('', null, null, () => 'translateY(20px)')

            expect(out).toContain('transform: translateY(20px)')
        })

        it('does not run transformTemplate over explicit transform strings', () => {
            const out = mergeInlineStyles(
                '',
                { transform: 'translate(100px)' },
                null,
                () => 'translateY(20px)'
            )

            expect(out).toContain('transform: translate(100px)')
            expect(out).not.toContain('translateY(20px)')
        })

        it('removes the transform declaration when the template returns an empty string', () => {
            const out = mergeInlineStyles(
                'transform: rotate(10deg); color: red',
                { x: 10 },
                null,
                () => ''
            )

            expect(out).toContain('color: red')
            expect(out).not.toContain('transform:')
        })

        it('propagates errors thrown by the template callback', () => {
            expect(() =>
                mergeInlineStyles('', { x: 10 }, null, () => {
                    throw new Error('Template error')
                })
            ).toThrow('Template error')
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

describe('serializeMotionStyle', () => {
    it('serializes object-form styles with static CSS and transform shortcuts', () => {
        const out = serializeMotionStyle({
            x: 24,
            opacity: 0.5,
            backgroundColor: 'rgb(255, 0, 0)',
            '--glow-x': 12
        })

        expect(out).toContain('transform: translateX(24px)')
        expect(out).toContain('opacity: 0.5')
        expect(out).toContain('background-color: rgb(255, 0, 0)')
        expect(out).toContain('--glow-x: 12')
    })

    it('serializes MotionValues with their current value for initial markup', () => {
        const x = motionValue(48)
        const opacity = motionValue(0.75)

        const out = serializeMotionStyle({ x, opacity })

        expect(out).toContain('transform: translateX(48px)')
        expect(out).toContain('opacity: 0.75')
    })

    it('serializes object-form styles through transformTemplate', () => {
        const out = serializeMotionStyle(
            { x: 24 },
            ({ x }, generated) => `translateY(${x}) ${generated}`
        )

        expect(out).toContain('transform: translateY(24px) translateX(24px)')
    })

    it('serializes missing style through transformTemplate', () => {
        const out = serializeMotionStyle(undefined, () => 'translateY(20px)')

        expect(out).toContain('transform: translateY(20px)')
    })

    it('passes string styles through unchanged', () => {
        expect(serializeMotionStyle('color: red')).toBe('color: red')
    })
})

describe('applyMotionStyleEffect', () => {
    it('updates MotionValue transform styles through transformTemplate', () => {
        const el = document.createElement('div')
        const x = motionValue(12)

        const cleanup = applyMotionStyleEffect(
            el,
            { x },
            ({ x: latestX }, generated) => `translateY(${latestX}) ${generated}`
        )

        expect(el.getAttribute('style')).toContain('translateY(12px) translateX(12px)')

        x.set(36)

        expect(el.getAttribute('style')).toContain('translateY(36px) translateX(36px)')

        cleanup?.()
    })

    it('reapplies templated MotionValue styles after later subscribers write generated transforms', async () => {
        const el = document.createElement('div')
        const x = motionValue(12)

        const cleanup = applyMotionStyleEffect(
            el,
            { x },
            ({ x: latestX }, generated) => `translateY(${latestX}) ${generated}`
        )
        const generatedCleanup = x.on('change', (latestX) => {
            el.setAttribute('style', `transform: translateX(${latestX}px)`)
        })

        x.set(36)
        await Promise.resolve()

        expect(el.getAttribute('style')).toContain('translateY(36px) translateX(36px)')

        generatedCleanup()
        cleanup?.()
    })

    it('coalesces deferred style writes across same-tick MotionValue changes', () => {
        const el = document.createElement('div')
        const x = motionValue(12)
        const y = motionValue(4)
        const queuedMicrotasks: VoidFunction[] = []
        const queuedFrames: FrameRequestCallback[] = []
        const queueMicrotaskSpy = vi
            .spyOn(globalThis, 'queueMicrotask')
            .mockImplementation((callback) => {
                queuedMicrotasks.push(callback)
            })
        const requestAnimationFrameSpy = vi
            .spyOn(globalThis, 'requestAnimationFrame')
            .mockImplementation((callback) => {
                queuedFrames.push(callback)
                return queuedFrames.length
            })

        try {
            const cleanup = applyMotionStyleEffect(
                el,
                { x, y },
                ({ x: latestX }, generated) => `translateY(${latestX}) ${generated}`
            )

            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1)
            expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)

            x.set(24)
            y.set(18)

            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1)
            expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)

            queuedMicrotasks.shift()?.()
            queuedFrames.shift()?.(performance.now())
            x.set(36)

            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(2)
            expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)

            cleanup?.()
        } finally {
            queueMicrotaskSpy.mockRestore()
            requestAnimationFrameSpy.mockRestore()
        }
    })
})

describe('collectMotionStyleValues', () => {
    it('returns only MotionValue entries from object-form styles', () => {
        const x = motionValue(24)
        const glow = motionValue('40%')

        const values = collectMotionStyleValues({
            x,
            opacity: 0.5,
            '--glow-x': glow
        })

        expect(values).toEqual({ x, '--glow-x': glow })
    })

    it('returns undefined when no MotionValues are present', () => {
        expect(collectMotionStyleValues({ opacity: 0.5 })).toBeUndefined()
        expect(collectMotionStyleValues('opacity: 0.5')).toBeUndefined()
    })
})

describe('extractTransform', () => {
    it('reads transform from object-form style props', () => {
        expect(extractTransform({ transform: 'rotate(12deg)' })).toBe('rotate(12deg)')
    })

    it('reads transform from object-form MotionValues', () => {
        expect(extractTransform({ transform: motionValue('scale(1.2)') })).toBe('scale(1.2)')
    })
})
