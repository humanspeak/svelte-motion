import { motionValue } from 'motion-dom'
import { describe, expect, it, vi } from 'vitest'
import {
    bindMotionValueChild,
    isMotionValueChild,
    renderMotionValueChild
} from './motionValueChild'

describe('utils/motionValueChild', () => {
    it('detects motion values and rejects non-motion children', () => {
        expect(isMotionValueChild(motionValue(5))).toBe(true)
        expect(isMotionValueChild('5')).toBe(false)
        expect(isMotionValueChild({ get: () => 5 })).toBe(false)
    })

    it('renders the current motion value as text', () => {
        expect(renderMotionValueChild(motionValue(42))).toBe('42')
        expect(renderMotionValueChild(motionValue('online'))).toBe('online')
    })

    it('binds future motion value changes to element textContent', () => {
        const value = motionValue(10)
        const element = document.createElement('span')
        const onRender = vi.fn()
        const unsubscribe = bindMotionValueChild(value, element, onRender)

        value.set(27)

        expect(element.textContent).toBe('27')
        expect(onRender).toHaveBeenCalledWith('27')

        unsubscribe()
        value.set(88)
        expect(element.textContent).toBe('27')
    })
})
