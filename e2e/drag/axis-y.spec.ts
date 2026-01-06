import { expect, test } from '@playwright/test'

test.describe('drag/axis-y', () => {
    test('guide is behind box per z-index', async ({ page }) => {
        await page.goto('/tests/drag/axis-y?@isPlaywright=true')
        const guideZ = await page
            .getByTestId('axis-guide')
            .evaluate((el) => getComputedStyle(el).zIndex)
        const boxZ = await page.getByTestId('drag-y').evaluate((el) => getComputedStyle(el).zIndex)
        expect(parseInt(guideZ || '0')).toBeLessThan(parseInt(boxZ || '0'))
    })
    test('moves on y but not x', async ({ page }) => {
        await page.goto('/tests/drag/axis-y?@isPlaywright=true')
        const el = page.getByTestId('drag-y')
        await el.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        // Use Playwright's mouse API for reliable cross-platform behavior
        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.mouse.move(s.x + 60, s.y + 80, { steps: 5 })
        await page.mouse.up()

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.y).toBeGreaterThan(s.y + 20)
        expect(Math.abs(e.x - s.x)).toBeLessThan(5)
    })
})
