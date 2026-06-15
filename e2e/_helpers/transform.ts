import type { Page } from '@playwright/test'

/**
 * Read the rendered `matrix(...)` transform from an element and return the
 * translate (`tx`, `ty`) and uniform scale (`a` = `d` for non-skew transforms).
 *
 * Returns zeros (and scale=1) on `'none'` or unparseable input.
 *
 * Defined here as a thin browser-side helper so the same parser is shared
 * across `e2e/drag/*.spec.ts` files. Each spec passes the selector through
 * to `page.evaluate`, so the function body is what actually runs in-page.
 */
export const readTransform = (
    page: Page,
    selector: string
): Promise<{ tx: number; ty: number; a: number; b: number; c: number; d: number }> =>
    page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null
        if (!el) return { tx: 0, ty: 0, a: 1, b: 0, c: 0, d: 1 }
        const t = window.getComputedStyle(el).transform
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return { tx: 0, ty: 0, a: 1, b: 0, c: 0, d: 1 }
        const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
        return {
            a: parts[0] ?? 1,
            b: parts[1] ?? 0,
            c: parts[2] ?? 0,
            d: parts[3] ?? 1,
            tx: parts[4] ?? 0,
            ty: parts[5] ?? 0
        }
    }, selector)

/** Convenience: just translateX of the matched element. */
export const readTranslateX = async (page: Page, selector = '[data-testid="drag-card"]') =>
    (await readTransform(page, selector)).tx

/** Convenience: just translate (tx, ty) of the matched element. */
export const readTranslate = async (page: Page, selector = '[data-testid="drag-card"]') => {
    const t = await readTransform(page, selector)
    return { tx: t.tx, ty: t.ty }
}
