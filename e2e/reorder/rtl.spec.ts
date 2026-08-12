import { expect, test } from '@playwright/test'

test.describe('reorder/rtl', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/rtl?@isPlaywright=true')
        await page.getByTestId('item-aleph').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('maps leftward visual travel to the next logical value', async ({ page }) => {
        const aleph = page.getByTestId('item-aleph')
        const before = await aleph.boundingBox()
        if (!before) throw new Error('no aleph box')
        const cx = before.x + before.width / 2
        const cy = before.y + before.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx - (i * 110) / 12, cy)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()

        await expect(page.getByTestId('order')).toHaveText('bet,aleph,gimel,dalet')
        await page.waitForTimeout(700)
        const after = await aleph.boundingBox()
        if (!after) throw new Error('aleph did not settle')
        expect(Math.abs(after.x - (before.x - 100))).toBeLessThan(2)
        expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    })
})
