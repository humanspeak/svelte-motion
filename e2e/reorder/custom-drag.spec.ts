import { expect, test } from '@playwright/test'

test.describe('reorder/custom-drag', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/custom-drag?@isPlaywright=true')
        await page.getByTestId('item-one').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('`drag` on the item unlocks both axes and still reorders', async ({ page }) => {
        const one = page.getByTestId('item-one')
        const box = await one.boundingBox()
        if (!box) throw new Error('no box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        // Diagonal drag: x moves freely (unlocked) while the y travel
        // still crosses the next item's center (54px pitch) and reorders.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(cx + (i * 80) / 10, cy + (i * 60) / 10)
            await page.waitForTimeout(16)
        }
        const mid = await one.boundingBox()
        if (!mid) throw new Error('no mid box')
        expect(mid.x - box.x).toBeGreaterThan(40)

        await page.mouse.up()
        expect(await page.getByTestId('order').textContent()).toBe('two,one,three')
    })
})
