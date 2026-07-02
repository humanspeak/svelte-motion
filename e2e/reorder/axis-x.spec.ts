import { expect, test, type Page } from '@playwright/test'

const order = (page: Page) => page.getByTestId('order').textContent()

test.describe('reorder/axis-x', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/axis-x?@isPlaywright=true')
        await page.getByTestId('tile-red').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('drags a tile right one slot to reorder', async ({ page }) => {
        const red = page.getByTestId('tile-red')
        const box = await red.boundingBox()
        if (!box) throw new Error('no box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        // Tile pitch is 100px (90px tile + 10px gap); 110px crosses the
        // next tile's center.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx + (i * 110) / 12, cy)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()

        expect(await order(page)).toBe('amber,red,green,blue')

        // Settles one tile pitch to the right of where it started.
        await page.waitForTimeout(700)
        const after = await red.boundingBox()
        if (!after) throw new Error('no after box')
        expect(Math.abs(after.x - (box.x + 100))).toBeLessThan(2)
        expect(Math.abs(after.y - box.y)).toBeLessThan(1)
    })

    test('drags a tile left one slot to reorder', async ({ page }) => {
        const green = page.getByTestId('tile-green')
        const box = await green.boundingBox()
        if (!box) throw new Error('no box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx - (i * 110) / 12, cy)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()

        expect(await order(page)).toBe('red,green,amber,blue')
    })
})
