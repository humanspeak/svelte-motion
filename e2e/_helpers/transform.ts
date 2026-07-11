import type { Locator, Page } from '@playwright/test'

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
        const el = document.querySelector<HTMLElement>(sel)
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

/**
 * Read the drag-owned transform channel from the test element.
 * Unlike the computed matrix, this excludes authored/base transforms.
 */
export const readDragTranslate = (
    page: Page,
    selector: string
): Promise<{ tx: number; ty: number }> =>
    page.evaluate((sel) => {
        const el = document.querySelector<HTMLElement>(sel)
        const transform = el?.dataset.svelteMotionDragTransform ?? ''
        const read = (axis: 'X' | 'Y') => {
            const match = transform.match(new RegExp(`translate${axis}\\((-?[0-9.]+)px\\)`))
            return match ? Number.parseFloat(match[1]) : 0
        }

        return { tx: read('X'), ty: read('Y') }
    }, selector)

/** Await one rendered animation frame. */
export const nextFrame = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

/**
 * Read the rotation (degrees) of a locator's computed transform via
 * DOMMatrix decomposition. Handles skewed matrices, unlike the regex parser.
 */
export const readRotation = (card: Locator) =>
    card.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
    })

/** Sample a per-frame reader across `count` consecutive animation frames. */
export const sampleFrames = async <T>(page: Page, read: () => Promise<T>, count = 8) => {
    const samples: T[] = []
    for (let frame = 0; frame < count; frame++) {
        await nextFrame(page)
        samples.push(await read())
    }
    return samples
}

/**
 * Press the pointer at a locator's center and drag 56px right, leaving the
 * pointer held down. Returns the press origin.
 */
export const beginHorizontalDrag = async (page: Page, card: Locator) => {
    await card.waitFor({ state: 'visible' })
    await card.scrollIntoViewIfNeeded()
    const box = await card.boundingBox()
    if (!box) throw new Error('missing drag-card bounds')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 56, y, { steps: 6 })
    return { x, y }
}
