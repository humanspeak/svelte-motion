import { expect, test } from '@playwright/test'

test.describe('reorder/grid', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/grid?@isPlaywright=true')
        await page.getByTestId('tile-a').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('moves across a row boundary and FLIPs displaced siblings', async ({ page }) => {
        const tile = page.getByTestId('tile-a')
        const before = await tile.boundingBox()
        if (!before) throw new Error('no tile-a box')
        const cx = before.x + before.width / 2
        const cy = before.y + before.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 16; i++) {
            await page.mouse.move(cx + (i * 110) / 16, cy + (i * 110) / 16)
            await page.waitForTimeout(16)
        }

        await expect(page.getByTestId('order')).toHaveText('b,c,d,e,a,f')
        const siblingTransforms = await page
            .getByTestId('grid-group')
            .locator('[data-testid^="tile-"]:not([data-testid="tile-a"])')
            .evaluateAll((elements) =>
                elements.map((element) => getComputedStyle(element).transform)
            )
        expect(siblingTransforms.some((transform) => transform !== 'none')).toBe(true)

        await page.mouse.up()
        await page.waitForTimeout(800)

        const after = await tile.boundingBox()
        if (!after) throw new Error('tile-a did not settle')
        expect(Math.abs(after.x - (before.x + 100))).toBeLessThan(2)
        expect(Math.abs(after.y - (before.y + 100))).toBeLessThan(2)
    })
})
