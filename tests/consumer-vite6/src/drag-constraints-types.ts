import type { DragConstraints } from '@humanspeak/svelte-motion'

// This fixture is compiled only. Every form motion-dom 14.9.1's
// `dragConstraints` accepts must also be a valid `DragConstraints`.
export const box: DragConstraints = { left: 0, right: 100 }
export const off: DragConstraints = false
export const svg: DragConstraints = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
export const ref: DragConstraints = { current: null as Element | null }
export const fn: DragConstraints = ({ originPoint }) => ({
    x: originPoint.x,
    y: originPoint.y,
    move() {},
    release: () => Promise.resolve()
})
// @ts-expect-error a string is not a constraint
export const bad: DragConstraints = 'parent'
