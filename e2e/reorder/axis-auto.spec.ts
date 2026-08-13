import { expect, test, type Page } from '@playwright/test'

const drag = async (page: Page, testId: string, dx: number, dy: number) => {
    const item = page.getByTestId(testId)
    const box = await item.boundingBox()
    if (!box) throw new Error(`no bounding box for ${testId}`)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
        await page.mouse.move(cx + (i * dx) / 12, cy + (i * dy) / 12)
        await page.waitForTimeout(16)
    }
    const held = await item.boundingBox()
    await page.mouse.up()
    return { before: box, held }
}

test.describe('reorder/axis-auto', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/axis-auto?@isPlaywright=true')
        await page.getByTestId('horizontal-red').waitFor({ state: 'visible' })
        await expect(page.getByTestId('horizontal-group')).toHaveAttribute('data-reorder-axis', 'x')
        await expect(page.getByTestId('vertical-group')).toHaveAttribute('data-reorder-axis', 'y')
    })

    test('detects a horizontal row and locks out perpendicular drift', async ({ page }) => {
        const { before, held } = await drag(page, 'horizontal-red', 110, 60)
        if (!held) throw new Error('horizontal item disappeared')

        await expect(page.getByTestId('horizontal-order')).toHaveText('amber,red,green,blue')
        expect(Math.abs(held.y - before.y)).toBeLessThan(1)
    })

    test('detects a vertical stack and locks out perpendicular drift', async ({ page }) => {
        const { before, held } = await drag(page, 'vertical-one', 80, 64)
        if (!held) throw new Error('vertical item disappeared')

        await expect(page.getByTestId('vertical-order')).toHaveText('two,one,three,four')
        expect(Math.abs(held.x - before.x)).toBeLessThan(1)
    })
})
