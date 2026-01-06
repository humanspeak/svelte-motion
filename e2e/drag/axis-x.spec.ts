import { expect, test } from '@playwright/test'

test.describe('drag/axis-x', () => {
    test('guide is behind box per z-index', async ({ page }) => {
        await page.goto('/tests/drag/axis-x?@isPlaywright=true')
        const guideZ = await page
            .getByTestId('axis-guide')
            .evaluate((el) => getComputedStyle(el).zIndex)
        const boxZ = await page.getByTestId('drag-x').evaluate((el) => getComputedStyle(el).zIndex)
        expect(parseInt(guideZ || '0')).toBeLessThan(parseInt(boxZ || '0'))
    })
    test('moves on x but not y', async ({ page }) => {
        await page.goto('/tests/drag/axis-x?@isPlaywright=true')
        const el = page.getByTestId('drag-x')
        await el.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        // Use Playwright's mouse API for reliable cross-platform behavior
        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.mouse.move(s.x + 80, s.y + 60, { steps: 5 })
        await page.mouse.up()

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.x).toBeGreaterThan(s.x + 20)
        expect(Math.abs(e.y - s.y)).toBeLessThan(5)
    })

    test('second drag respects x-only', async ({ page }) => {
        await page.goto('/tests/drag/axis-x?@isPlaywright=true')
        const el = page.getByTestId('drag-x')
        await el.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        // First drag
        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.mouse.move(s.x + 60, s.y + 0, { steps: 5 })
        await page.mouse.up()

        const m = await el.boundingBox()
        if (!m) throw new Error('no m')

        // Second drag
        await page.mouse.move(m.x + 10, m.y + 10)
        await page.mouse.down()
        await page.mouse.move(m.x + 30, m.y + 40, { steps: 5 })
        await page.mouse.up()

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.x - m.x).toBeGreaterThan(10)
        expect(Math.abs(e.y - m.y)).toBeLessThan(5)
    })
})
