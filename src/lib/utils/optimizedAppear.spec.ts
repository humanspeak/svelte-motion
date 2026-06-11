import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    createOptimizedAppearData,
    createOptimizedAppearScript,
    handoffOptimizedAppearAnimation,
    optimizedAppearDataAttribute,
    startOptimizedAppearAnimation
} from './optimizedAppear'

afterEach(() => {
    vi.restoreAllMocks()
    window.MotionIsMounted = undefined
    window.MotionHasOptimisedAnimation = undefined
    window.MotionHandoffMarkAsComplete = undefined
    window.MotionHandoffIsComplete = undefined
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
                keyframes: ['translateY(16px) scale(0.8)', 'translateY(0px) scale(1)'],
                options: {
                    duration: 600,
                    delay: 0,
                    fill: 'both',
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
                }
            }
        ])
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
