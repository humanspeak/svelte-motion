import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    completeOptimizedAppearHandoff,
    createOptimizedAppearData,
    createOptimizedAppearScript,
    handoffOptimizedAppearAnimation,
    optimizedAppearDataAttribute,
    prepareOptimizedAppearHandoff,
    startOptimizedAppearAnimation
} from './optimizedAppear'

afterEach(() => {
    vi.restoreAllMocks()
    window.MotionIsMounted = undefined
    window.MotionHasOptimisedAnimation = undefined
    window.MotionHandoffMarkAsComplete = undefined
    window.MotionHandoffIsComplete = undefined
    window.MotionHandoffAnimation = undefined
    window.MotionCancelOptimisedAnimation = undefined
    window.__SvelteMotionAppear = undefined
})

describe('optimizedAppear', () => {
    it('builds opacity and transform appear entries from initial and animate values', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, scale: 0.8, y: 16 },
            { opacity: 1, scale: 1, y: 0 },
            { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
        )

        expect(entries).toEqual([
            {
                name: 'opacity',
                keyframes: [0, 1],
                options: {
                    duration: 600,
                    delay: 0,
                    fill: 'both',
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
                }
            },
            {
                name: 'transform',
                keyframes: ['translateY(16px) scale(0.8)', 'none'],
                options: {
                    duration: 600,
                    delay: 0,
                    fill: 'both',
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
                }
            }
        ])
    })

    it('emits a WAAPI entry per non-transform CSS property in initial/animate', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, y: 8, filter: 'blur(8px)', clipPath: 'inset(0 0 100% 0)' },
            { opacity: 1, y: -8, filter: 'blur(0px)', clipPath: 'inset(0)' },
            { duration: 0.4, ease: 'easeOut' }
        )

        expect(entries).toHaveLength(4)
        expect(entries.map((e) => e.name)).toEqual(['opacity', 'transform', 'filter', 'clipPath'])
        expect(entries.find((e) => e.name === 'filter')?.keyframes).toEqual([
            'blur(8px)',
            'blur(0px)'
        ])
        expect(entries.find((e) => e.name === 'clipPath')?.keyframes).toEqual([
            'inset(0 0 100% 0)',
            'inset(0)'
        ])
    })

    it('emits a backgroundColor entry with the first concrete scalar from initial and the resting scalar from animate', () => {
        const entries = createOptimizedAppearData(
            { backgroundColor: ['#ff0000', '#00ff00'] },
            { backgroundColor: ['#0000ff', '#ffff00'] }
        )

        expect(entries).toEqual([
            {
                name: 'backgroundColor',
                keyframes: ['#ff0000', '#ffff00'],
                options: expect.objectContaining({ fill: 'both' })
            }
        ])
    })

    it('omits properties that are equal between initial and animate', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, filter: 'blur(4px)' },
            { opacity: 1, filter: 'blur(4px)' }
        )

        expect(entries.find((e) => e.name === 'filter')).toBeUndefined()
        expect(entries.map((e) => e.name)).toEqual(['opacity'])
    })

    it('skips SVG path-only keys and transform channels', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, pathLength: 0, strokeDasharray: '0 1', x: -10 },
            { opacity: 1, pathLength: 1, strokeDasharray: '1 0', x: 0 }
        )

        const names = entries.map((e) => e.name)
        expect(names).toContain('opacity')
        expect(names).toContain('transform')
        expect(names).not.toContain('pathLength')
        expect(names).not.toContain('strokeDasharray')
        expect(names).not.toContain('x')
    })

    it('omits non-string/non-number values and MotionValue-like objects', () => {
        const motionValue = { get: () => 'blur(4px)' }
        const entries = createOptimizedAppearData(
            { opacity: 0, filter: motionValue },
            { opacity: 1, filter: 'blur(0px)' }
        )

        expect(entries.find((e) => e.name === 'filter')).toBeUndefined()
    })

    it('creates an SSR bootstrap script with the upstream data attribute', () => {
        const script = createOptimizedAppearScript('appear-1', [
            {
                name: 'opacity',
                keyframes: [0, 1],
                options: { duration: 300, fill: 'both' }
            }
        ])

        expect(script).toContain('<script>')
        expect(script).toContain(optimizedAppearDataAttribute)
        expect(script).toContain('appear-1')
        expect(script).toContain('MotionHasOptimisedAnimation')
    })

    it('maps Motion easing names to native WAAPI easing strings', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0 },
            { opacity: 1 },
            { duration: 0.4, ease: 'easeInOut' }
        )

        expect(entries[0]?.options.easing).toBe('ease-in-out')
    })

    it('starts and hands off imperative optimized appear animations', () => {
        const element = document.createElement('div')
        element.dataset.framerAppearId = 'appear-2'
        const commitStyles = vi.fn()
        const cancel = vi.fn()
        const animation = { commitStyles, cancel, startTime: null } as unknown as Animation
        const animateSpy = vi.spyOn(element, 'animate').mockReturnValue(animation)

        startOptimizedAppearAnimation(element, 'opacity', [0, 1], { duration: 0.3 })

        expect(animateSpy).toHaveBeenCalled()
        expect(window.MotionHasOptimisedAnimation?.('appear-2')).toBe(true)
        expect(handoffOptimizedAppearAnimation('appear-2')).toBe(true)
        expect(commitStyles).toHaveBeenCalled()
        expect(cancel).toHaveBeenCalled()
        expect(window.MotionHandoffIsComplete?.('appear-2')).toBe(true)
    })

    it('hands decomposed transform values to the runtime animation owner', () => {
        const element = document.createElement('div')
        element.dataset.framerAppearId = 'appear-transform'
        const cancel = vi.fn()
        const animation = { cancel, startTime: null } as unknown as Animation
        vi.spyOn(element, 'animate').mockReturnValue(animation)

        startOptimizedAppearAnimation(element, 'transform', ['translateY(20px)', 'none'], {
            duration: 0.8
        })
        prepareOptimizedAppearHandoff()

        const postRenderCallbacks: Array<() => void> = []
        const frame = {
            postRender: vi.fn((callback: () => void) => {
                postRenderCallbacks.push(callback)
            })
        }

        expect(window.MotionHandoffAnimation?.('appear-transform', 'y', frame as never)).toEqual(
            expect.any(Number)
        )

        completeOptimizedAppearHandoff('appear-transform')
        expect(
            window.MotionHandoffAnimation?.('appear-transform', 'scale', frame as never)
        ).toBeNull()
        expect(window.MotionHasOptimisedAnimation?.('appear-transform', 'transform')).toBe(false)

        cancel.mockClear()
        postRenderCallbacks.shift()?.()
        postRenderCallbacks.shift()?.()
        expect(cancel).toHaveBeenCalledOnce()
    })

    it('creates an SSR bootstrap script with one shared ready animation gate', () => {
        const script = createOptimizedAppearScript('appear-3', [
            {
                name: 'opacity',
                keyframes: [0, 1],
                options: { duration: 300, fill: 'both' }
            },
            {
                name: 'transform',
                keyframes: ['scale(0)', 'scale(1)'],
                options: { duration: 300, fill: 'both' }
            }
        ])

        expect(script).toContain('if(!s.readyAnimation)')
        expect(script).toContain('const r=s.readyAnimation')
        expect(script).not.toContain('const key=k(p.id,a.name),ready=')
    })
})
