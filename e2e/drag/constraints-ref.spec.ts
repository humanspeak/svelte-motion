import { expect, test } from '@playwright/test'

test.describe('drag/constraints-ref', () => {
    test('is constrained inside container ref', async ({ page }) => {
        await page.goto('/tests/drag/constraints-ref?@isPlaywright=true')
        const el = page.getByTestId('drag-ref')
        await el.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        // Use Playwright's mouse API for reliable cross-platform behavior
        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.mouse.move(s.x + 300, s.y - 300, { steps: 10 })
        await page.mouse.up()

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        // Should not move wildly; still within ref bounds around the original area
        expect(e.x - s.x).toBeLessThan(260)
        expect(s.y - e.y).toBeLessThan(260)
    })
})
