/**
 * @vitest-environment jsdom
 */
import { scopeMotion } from 'motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { svelteMotionDragElements } from './drag.js'
import { drag } from './vanillaDrag.js'

const makeDiv = (className?: string) => {
    const el = document.createElement('div')
    if (className) el.className = className
    document.body.appendChild(el)
    return el
}

describe('utils/vanillaDrag - drag()', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
        document.body.innerHTML = ''
    })

    it('applies drag styles while attached and restores them on cleanup', () => {
        const el = makeDiv()
        const stop = drag(el)

        expect(typeof stop).toBe('function')
        expect(el.getAttribute('draggable')).toBe('false')
        expect(el.style.getPropertyValue('touch-action')).toBe('none')
        expect(el.style.getPropertyValue('user-select')).toBe('none')

        stop()

        expect(el.hasAttribute('draggable')).toBe(false)
        expect(el.style.getPropertyValue('touch-action')).toBe('')
        expect(el.style.getPropertyValue('user-select')).toBe('')
    })

    it('restores a pre-existing draggable attribute on cleanup', () => {
        const el = makeDiv()
        el.setAttribute('draggable', 'true')
        const stop = drag(el)
        expect(el.getAttribute('draggable')).toBe('false')
        stop()
        expect(el.getAttribute('draggable')).toBe('true')
    })

    it('lets the cross axis pan when dragging is restricted to one axis', () => {
        const x = makeDiv()
        const y = makeDiv()
        const stopX = drag(x, { axis: 'x' })
        const stopY = drag(y, { axis: 'y' })

        expect(x.style.getPropertyValue('touch-action')).toBe('pan-y')
        expect(y.style.getPropertyValue('touch-action')).toBe('pan-x')

        stopX()
        stopY()
    })

    it('skips elements a motion.* component already drags and warns once per element', () => {
        const el = makeDiv()
        svelteMotionDragElements.add(el)

        const stopA = drag(el)
        const stopB = drag(el)

        expect(el.hasAttribute('draggable')).toBe(false)
        expect(el.style.getPropertyValue('touch-action')).toBe('')
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain('[svelte-motion] drag(): element already has')

        expect(() => {
            stopA()
            stopB()
        }).not.toThrow()

        svelteMotionDragElements.delete(el)
    })

    it('still attaches to the other elements when some are skipped', () => {
        const guarded = makeDiv('item')
        const plain = makeDiv('item')
        svelteMotionDragElements.add(guarded)

        const stop = drag('.item')

        expect(guarded.hasAttribute('draggable')).toBe(false)
        expect(plain.getAttribute('draggable')).toBe('false')
        expect(warnSpy).toHaveBeenCalledTimes(1)

        stop()
        expect(plain.hasAttribute('draggable')).toBe(false)
        svelteMotionDragElements.delete(guarded)
    })

    it('resolves a selector within the active scopeMotion root', () => {
        const root = makeDiv()
        const inside = document.createElement('div')
        inside.className = 'handle'
        root.appendChild(inside)
        const outside = makeDiv('handle')

        const scope = scopeMotion(root, () => {
            drag('.handle')
        })

        expect(inside.getAttribute('draggable')).toBe('false')
        expect(outside.hasAttribute('draggable')).toBe(false)

        scope.stop()

        expect(inside.hasAttribute('draggable')).toBe(false)
    })

    it('returns a no-op cleanup when nothing resolves', () => {
        const stop = drag('.does-not-exist')
        expect(() => stop()).not.toThrow()
    })
})
