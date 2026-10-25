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

    // Upstream drag() has no "already dragged by a component" guard
    // (motion-dom src/gestures/drag/index.ts @ v14.5.0): it attaches a second
    // controller to the motion.div. Motion's global drag lock (setDragLock) and
    // the shared x motion value still keep the element moving once.
    test('motion-plus-drag: a motion.div drag="x" also passed to drag() moves once', async ({
        page
    }) => {
        await page.goto(URL)
        const status = page.getByTestId('vanilla-motion-plus-drag-status')
        await expect(status).toHaveAttribute('data-attached', 'true')

        const el = page.getByTestId('vanilla-motion-plus-drag')
        // Upstream drag styles (from both controllers) set this.
        await expect(el).toHaveAttribute('draggable', 'false')

        await dragBy(page, el, 100, 0)
        await page.waitForTimeout(500)

        const { x } = await readTranslate(el)
        // ~100px, never ~200px (two controllers both writing x).
        expect(x).toBeGreaterThan(70)
        expect(x).toBeLessThan(140)
    })
})

test.describe('drag/vanilla tester verdicts', () => {
    // Room to the right of the container for a long overshoot.
    test.use({ viewport: { width: 1920, height: 1080 } })

    // Elastic drag lets the box past the container edge; after a slow release
    // it springs back for longer than a fixed timer, so the verdict must wait
    // for the box to come to rest instead of reading it mid-return.
    test('container: a slow drag past the edge reads PASS once it springs back', async ({
        page
    }) => {
        await page.goto('/tests/drag/vanilla')
        const el = page.getByTestId('vanilla-container-box')
        await expect(el).toHaveAttribute('draggable', 'false')

        // Release while still moving outward, ~300px past the edge: the
        // return takes over a second.
        await el.scrollIntoViewIfNeeded()
        const box = await el.boundingBox()
        if (!box) throw new Error('no bounding box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        // Paced like a hand (one move per frame), so release keeps velocity.
        for (let i = 1; i <= 45; i += 1) {
            await page.mouse.move(cx + i * 30, cy)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()

        await expect(page.locator('[data-tester-verdict="container"]')).toHaveText(
            'PASS · inside',
            { timeout: 4000 }
        )
    })

    // data-is-loaded only renders under @isPlaywright, so the tester page must
    // wait on Motion's own readiness signal to attach drag() at all.
    test('motion-plus-drag: drag() attaches for testers, and repeat drags read PASS', async ({
        page
    }) => {
        await page.goto('/tests/drag/vanilla')
        const el = page.getByTestId('vanilla-motion-plus-drag')
        await expect(page.getByTestId('vanilla-motion-plus-drag-status')).toHaveAttribute(
            'data-attached',
            'true'
        )
        const chip = page.locator('[data-tester-verdict="motion-plus-drag"]')

        await dragBy(page, el, 40, 0)
        await expect(chip).toContainText('for a 40px drag')
        await expect(chip).toHaveText(/^PASS/)
        // The second verdict judges this drag only, not the running total.
        await dragBy(page, el, 50, 0)
        await expect(chip).toContainText('for a 50px drag')
        await expect(chip).toHaveText(/^PASS/)
    })
})
