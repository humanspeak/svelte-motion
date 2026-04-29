import { describe, expect, it, vi } from 'vitest'
import { useAnimate } from './animate.svelte.js'

describe('utils/animate - useAnimate', () => {
    it('returns a [scope, animate] tuple', () => {
        const [scope, animate] = useAnimate()
        expect(typeof scope).toBe('function')
        expect(typeof animate).toBe('function')
    })

    it('initialises scope with current=undefined and an empty animations array', () => {
        const [scope] = useAnimate()
        expect(scope.current).toBeUndefined()
        expect(Array.isArray(scope.animations)).toBe(true)
        expect(scope.animations).toHaveLength(0)
    })

    it('hydrates scope.current when invoked as an attachment', () => {
        const [scope] = useAnimate()
        const parent = document.createElement('ul')
        scope(parent)
        expect(scope.current).toBe(parent)
    })

    it('clears scope.current when the attachment cleanup runs', () => {
        const [scope] = useAnimate()
        const parent = document.createElement('ul')
        const cleanup = scope(parent)
        cleanup()
        expect(scope.current).toBeUndefined()
    })

    it('resolves string selectors against scope.current', () => {
        const [scope, animate] = useAnimate()
        const parent = document.createElement('ul')
        const li1 = document.createElement('li')
        const li2 = document.createElement('li')
        parent.append(li1, li2)
        document.body.append(parent)
        scope(parent)

        const animation = animate('li', { opacity: 0.5 }, { duration: 0.001 })
        expect(animation).toBeTruthy()
        expect(scope.animations.length).toBeGreaterThan(0)

        document.body.removeChild(parent)
    })

    it('stops in-flight animations and clears the list when the parent detaches', () => {
        const [scope, animate] = useAnimate()
        const parent = document.createElement('div')
        const child = document.createElement('span')
        parent.append(child)
        document.body.append(parent)
        const cleanup = scope(parent)

        const animation = animate('span', { opacity: 0.5 }, { duration: 10 })
        const stopSpy = vi.spyOn(animation, 'stop')

        cleanup()

        expect(stopSpy).toHaveBeenCalled()
        expect(scope.animations).toHaveLength(0)
        expect(scope.current).toBeUndefined()

        document.body.removeChild(parent)
    })

    it('animates element references directly (no scope hydration required)', () => {
        const [, animate] = useAnimate()
        const el = document.createElement('div')
        document.body.append(el)

        const animation = animate(el, { opacity: 0.5 }, { duration: 0.001 })
        expect(animation).toBeTruthy()

        document.body.removeChild(el)
    })

    it('supports animation sequences', () => {
        const [scope, animate] = useAnimate()
        const parent = document.createElement('div')
        const a = document.createElement('span')
        const b = document.createElement('span')
        a.classList.add('a')
        b.classList.add('b')
        parent.append(a, b)
        document.body.append(parent)
        scope(parent)

        const animation = animate(
            [
                ['.a', { opacity: 0.5 }, { duration: 0.001 }],
                ['.b', { opacity: 0.5 }, { duration: 0.001, at: '<' }]
            ],
            { duration: 0.01 }
        )
        expect(animation).toBeTruthy()

        document.body.removeChild(parent)
    })

    it('reattaching to a new parent updates scope.current', () => {
        const [scope] = useAnimate()
        const first = document.createElement('div')
        const second = document.createElement('div')

        const cleanupFirst = scope(first)
        expect(scope.current).toBe(first)
        cleanupFirst()

        scope(second)
        expect(scope.current).toBe(second)
    })
})
