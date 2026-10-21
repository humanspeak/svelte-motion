import { expect, test, type Locator, type Page } from '@playwright/test'

const URL = '/tests/drag/vanilla?@isPlaywright=true'

/** The element's current translateX/translateY from its computed transform. */
const readTranslate = (el: Locator) =>
    el.evaluate((node) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(node).transform)
        return { x: m.m41, y: m.m42 }
    })

/**
 * Drag from the element's centre by (dx, dy) in small steps, then hold still
 * before releasing so momentum has (almost) no velocity to carry.
 */
const dragBy = async (page: Page, el: Locator, dx: number, dy: number) => {
    await el.scrollIntoViewIfNeeded()
    const box = await el.boundingBox()
    if (!box) throw new Error('no bounding box')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + dx, cy + dy, { steps: 20 })
    await page.waitForTimeout(200)
    await page.mouse.up()
}

test.describe('drag/vanilla', () => {
    test('axis + box constraints: moves on x only and stops at right: 200', async ({ page }) => {
        await page.goto(URL)
        const el = page.getByTestId('vanilla-axis')
        await expect(el).toHaveAttribute('draggable', 'false')

        await dragBy(page, el, 320, 60)

        await expect
            .poll(async () => (await readTranslate(el)).x, { timeout: 4000 })
            .toBeGreaterThan(170)
        await page.waitForTimeout(800)
        const { x, y } = await readTranslate(el)
        expect(x).toBeLessThanOrEqual(205)
        expect(x).toBeGreaterThan(170)
        expect(Math.abs(y)).toBeLessThan(3)
    })

    test('animate() then drag(): the drag continues from the animated x', async ({ page }) => {
        await page.goto(URL)
        const el = page.getByTestId('vanilla-handoff')
        await expect(el).toHaveAttribute('data-ready', 'true')
        await expect.poll(async () => (await readTranslate(el)).x).toBeCloseTo(120, 0)

        await dragBy(page, el, 50, 0)

        await page.waitForTimeout(800)
        const { x } = await readTranslate(el)
        // Near 170 (120 + 50), not near 50 (a drag that ignored the animation).
        expect(x).toBeGreaterThan(145)
        expect(x).toBeLessThan(200)
    })

    test('element constraints: stays inside the container', async ({ page }) => {
        await page.goto(URL)
        const el = page.getByTestId('vanilla-container-box')
        const container = page.getByTestId('vanilla-container')
        await expect(el).toHaveAttribute('draggable', 'false')

        await dragBy(page, el, 400, 300)
        await page.waitForTimeout(1200)

        const r = await el.boundingBox()
        const c = await container.boundingBox()
        if (!r || !c) throw new Error('no bounding box')
        const tol = 4
        expect(r.x).toBeGreaterThanOrEqual(c.x - tol)
        expect(r.y).toBeGreaterThanOrEqual(c.y - tol)
        expect(r.x + r.width).toBeLessThanOrEqual(c.x + c.width + tol)
        expect(r.y + r.height).toBeLessThanOrEqual(c.y + c.height + tol)
        // It did move toward the bottom-right corner.
        const { x, y } = await readTranslate(el)
        expect(x).toBeGreaterThan(40)
        expect(y).toBeGreaterThan(20)
    })

    test('guard: drag() skips a motion.div that already drags (no double movement)', async ({
        page
    }) => {
        await page.goto(URL)
        const status = page.getByTestId('vanilla-guard-status')
        await expect(status).toHaveAttribute('data-attached', 'true')
        await expect(status).toHaveAttribute('data-skipped', 'true')

        const el = page.getByTestId('vanilla-guard')
        await expect(el).not.toHaveAttribute('draggable', 'false')

        await dragBy(page, el, 100, 0)
        await page.waitForTimeout(500)

        const { x } = await readTranslate(el)
        // ~100px, never ~200px (two controllers both writing x).
        expect(x).toBeGreaterThan(70)
        expect(x).toBeLessThan(140)
    })
})
