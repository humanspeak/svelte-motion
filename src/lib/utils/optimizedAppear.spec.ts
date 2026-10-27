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

    it('keeps backgroundColor on the main thread, mirroring upstream acceleratedValues', () => {
        const entries = createOptimizedAppearData(
            { backgroundColor: ['#ff0000', '#00ff00'] },
            { backgroundColor: ['#0000ff', '#ffff00'] }
        )

        expect(entries).toEqual([])
    })

    it('omits Motion pseudo-properties and unnormalized dimensional values', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, originX: 0, originY: 1, width: 100, borderRadius: 0 },
            { opacity: 1, originX: 1, originY: 0, width: 200, borderRadius: 12 }
        )

        expect(entries.map((e) => e.name)).toEqual(['opacity'])
    })

    it('resolves per-key transitions like upstream getValueTransition', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, y: 8, filter: 'blur(8px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)' },
            {
                duration: 0.4,
                opacity: { duration: 0.2 },
                filter: { duration: 2 }
            } as never
        )

        const byName = Object.fromEntries(entries.map((e) => [e.name, e.options]))
        expect(byName.opacity.duration).toBe(200)
        expect(byName.filter.duration).toBe(2000)
        expect(byName.transform.duration).toBe(400)
    })

    it('falls back to transition.default before the top-level transition', () => {
        const entries = createOptimizedAppearData(
            { filter: 'blur(8px)' },
            { filter: 'blur(0px)' },
            {
                duration: 0.4,
                default: { duration: 1 }
            } as never
        )

        expect(entries[0]?.options.duration).toBe(1000)
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

/**
 * Upstream #1725 (`ad11115e9`, `1a451de16`): the generator builds the appear
 * animation from initial's `transition.out` when it's set, otherwise from
 * animate's own transition, the rule the runtime's mount animation follows.
 */
describe('createOptimizedAppearData mount transition (#1725)', () => {
    const optionsOf = (entries: ReturnType<typeof createOptimizedAppearData>, name: string) =>
        entries.find((e) => e.name === name)!.options

    it("uses initial's transition.out when set", () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, transition: { out: { duration: 2.4, ease: 'linear' } } },
            { opacity: 1 },
            { duration: 0.6, ease: 'linear' }
        )
        const options = optionsOf(entries, 'opacity')
        expect(options.duration).toBe(2400)
        expect(options.easing).toBe('linear')
    })

    it("out: true reuses initial's own transition", () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, transition: { out: true, duration: 1.2 } },
            { opacity: 1 },
            { duration: 0.6 }
        )
        expect(optionsOf(entries, 'opacity').duration).toBe(1200)
    })

    it('resolves value-specific keys inside the out transition', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, y: 10, transition: { out: { duration: 1, opacity: { duration: 2 } } } },
            { opacity: 1, y: 0 },
            { duration: 0.3 }
        )
        expect(optionsOf(entries, 'opacity').duration).toBe(2000)
        expect(optionsOf(entries, 'transform').duration).toBe(1000)
    })

    it("falls back to animate's own transition", () => {
        const entries = createOptimizedAppearData(
            { opacity: 0 },
            { opacity: 1, transition: { duration: 2 } },
            { duration: 0.6 }
        )
        expect(optionsOf(entries, 'opacity').duration).toBe(2000)
    })

    it("animate's transition merges the prop only with inherit: true", () => {
        const entries = createOptimizedAppearData(
            { opacity: 0 },
            { opacity: 1, transition: { inherit: true, delay: 0.5 } },
            { duration: 0.8 }
        )
        const options = optionsOf(entries, 'opacity')
        expect(options.duration).toBe(800)
        expect(options.delay).toBe(500)
    })

    it("an initial transition without out doesn't time the mount", () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, transition: { duration: 5 } },
            { opacity: 1 },
            { duration: 0.6 }
        )
        expect(optionsOf(entries, 'opacity').duration).toBe(600)
    })

    it('the 4th argument overrides where out is read from', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, transition: { out: { duration: 9 } } },
            { opacity: 1 },
            { duration: 0.6 },
            { out: { duration: 1.5 } }
        )
        expect(optionsOf(entries, 'opacity').duration).toBe(1500)
    })

    it('a null 4th argument means the first label has no transition', () => {
        const entries = createOptimizedAppearData(
            { opacity: 0, transition: { out: { duration: 9 } } },
            { opacity: 1 },
            { duration: 0.6 },
            null
        )
        expect(optionsOf(entries, 'opacity').duration).toBe(600)
    })
})
