import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import { animate } from 'motion'

export function measureRect(el: HTMLElement): DOMRect {
    const prev = el.style.transform
    el.style.transform = 'none'
    const rect = el.getBoundingClientRect()
    el.style.transform = prev
    return rect
}

export function computeFlipTransforms(
    prev: DOMRect,
    next: DOMRect,
    mode: boolean | 'position'
): {
    dx: number
    dy: number
    sx: number
    sy: number
    shouldTranslate: boolean
    shouldScale: boolean
} {
    const dx = prev.left - next.left
    const dy = prev.top - next.top
    const sx = next.width > 0 ? prev.width / next.width : 1
    const sy = next.height > 0 ? prev.height / next.height : 1

    const shouldTranslate = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
    const shouldScale = mode !== 'position' && (Math.abs(1 - sx) > 0.01 || Math.abs(1 - sy) > 0.01)
    return { dx, dy, sx, sy, shouldTranslate, shouldScale }
}

export function runFlipAnimation(
    el: HTMLElement,
    transforms: {
        dx: number
        dy: number
        sx: number
        sy: number
        shouldTranslate: boolean
        shouldScale: boolean
    },
    transition: AnimationOptions
): void {
    const { dx, dy, sx, sy, shouldTranslate, shouldScale } = transforms
    if (!(shouldTranslate || shouldScale)) return

    const keyframes: Record<string, unknown> = {}
    if (shouldTranslate) {
        keyframes.x = [dx, 0]
        keyframes.y = [dy, 0]
    }
    if (shouldScale) {
        keyframes.scaleX = [sx, 1]
        keyframes.scaleY = [sy, 1]
        ;(keyframes as Record<string, unknown>).transformOrigin = '0 0'
    }

    const parts: string[] = []
    if (shouldTranslate) parts.push(`translate(${dx}px, ${dy}px)`)
    if (shouldScale) parts.push(`scale(${sx}, ${sy})`)
    el.style.transformOrigin = '0 0'
    el.style.transform = parts.join(' ')

    animate(el, keyframes as unknown as DOMKeyframesDefinition, transition)
}

export function setCompositorHints(el: HTMLElement, enabled: boolean): void {
    el.style.willChange = enabled ? 'transform' : ''
    el.style.transformOrigin = enabled ? '0 0' : ''
    if (!enabled) el.style.transform = ''
}

export function observeLayoutChanges(el: HTMLElement, onChange: () => void): () => void {
    const schedule = () => onChange()
    const ro = new ResizeObserver(() => schedule())
    ro.observe(el)
    const mo = new MutationObserver(() => schedule())
    mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] })
    if (el.parentElement) {
        mo.observe(el.parentElement, { childList: true, subtree: false, attributes: true })
    }
    return () => {
        ro.disconnect()
        mo.disconnect()
    }
}
