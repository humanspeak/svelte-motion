import { drag, motionValue } from '$lib'
import { expect, it } from 'vitest'

it('drag() accepts this library’s motion values for x/y', () => {
    const el = document.createElement('div')
    const x = motionValue(0)
    const stop = drag(el, { axis: 'x', x })
    stop()
    expect(typeof stop).toBe('function')
})
