import { expect, test, type Page } from '@playwright/test'

const order = (page: Page) => page.getByTestId('order').textContent()

/** Drag a locator vertically by `dy` px in small steps so each move carries velocity. */
const dragVertically = async (page: Page, testId: string, dy: number) => {
    const item = page.getByTestId(testId)
    const box = await item.boundingBox()
    if (!box) throw new Error(`no bounding box for ${testId}`)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    const steps = Math.max(10, Math.round(Math.abs(dy) / 5))
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(cx, cy + (i * dy) / steps)
        await page.waitForTimeout(16)
    }
    await page.mouse.up()
}

test.describe('reorder/basic', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/basic?@isPlaywright=true')
        await page.getByTestId('item-tomato').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('renders the initial order', async ({ page }) => {
        expect(await order(page)).toBe('tomato,cucumber,cheese,lettuce')
    })

    test('drags an item down one slot to reorder', async ({ page }) => {
        // Row pitch is 54px (44px item + 10px margin); 60px crosses the
        // next item's center.
        await dragVertically(page, 'item-tomato', 60)
        expect(await order(page)).toBe('cucumber,tomato,cheese,lettuce')
    })

    test('drags an item up one slot to reorder', async ({ page }) => {
        await dragVertically(page, 'item-cheese', -60)
        expect(await order(page)).toBe('tomato,cheese,cucumber,lettuce')
    })

    test('crosses multiple positions in one gesture', async ({ page }) => {
        await dragVertically(page, 'item-tomato', 130)
        expect(await order(page)).toBe('cucumber,cheese,tomato,lettuce')
    })

    test('settles into the new slot after release', async ({ page }) => {
        const tomato = page.getByTestId('item-tomato')
        const cucumber = page.getByTestId('item-cucumber')
        const cucumberSlot = await cucumber.boundingBox()
        if (!cucumberSlot) throw new Error('no cucumber box')

        await dragVertically(page, 'item-tomato', 60)

        // Wait for the snap-to-origin settle animation to finish.
        let settled: { x: number; y: number } | null = null
        let lastY = NaN
        let stable = 0
        for (let i = 0; i < 30; i++) {
            await page.waitForTimeout(50)
            const bb = await tomato.boundingBox()
            if (!bb) continue
            if (!Number.isNaN(lastY) && Math.abs(bb.y - lastY) < 0.5) {
                stable++
                if (stable >= 3) {
                    settled = { x: bb.x, y: bb.y }
                    break
                }
            } else {
                stable = 0
            }
            lastY = bb.y
        }

        if (!settled) throw new Error('item never settled')
        // Tomato now occupies cucumber's old slot.
        expect(Math.abs(settled.y - cucumberSlot.y)).toBeLessThan(2)
        expect(Math.abs(settled.x - cucumberSlot.x)).toBeLessThan(2)
    })

    test('locks dragging to the group axis', async ({ page }) => {
        const tomato = page.getByTestId('item-tomato')
        const box = await tomato.boundingBox()
        if (!box) throw new Error('no box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(cx + i * 8, cy)
            await page.waitForTimeout(16)
        }
        const mid = await tomato.boundingBox()
        await page.mouse.up()

        if (!mid) throw new Error('no mid box')
        expect(Math.abs(mid.x - box.x)).toBeLessThan(1)
        expect(await order(page)).toBe('tomato,cucumber,cheese,lettuce')
    })
})
