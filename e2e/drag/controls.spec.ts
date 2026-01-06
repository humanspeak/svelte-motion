import { expect, test } from '@playwright/test'

test.describe('drag/controls', () => {
    test('imperative start moves x only with dragControls', async ({ page }) => {
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        const h = await handle.boundingBox()
        if (!s) throw new Error('no s')
        if (!h) throw new Error('no h')

        // Use Playwright's mouse API for reliable cross-platform behavior
        // Click on handle to initiate drag
        await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
        await page.mouse.down()
        await page.mouse.move(s.x + 60, s.y + 40, { steps: 5 })
        await page.mouse.up()

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.x).toBeGreaterThan(s.x + 10)
        expect(Math.abs(e.y - s.y)).toBeLessThan(5)
    })

    test('tiny right nudge does NOT teleport on x-only dragControls', async ({ page }) => {
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        const h = await handle.boundingBox()
        if (!s) throw new Error('no s')
        if (!h) throw new Error('no h')

        // Use mouse API for micro nudge
        await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
        await page.mouse.down()
        // micro nudge on x (just 2px)
        await page.mouse.move(h.x + h.width / 2 + 2, h.y + h.height / 2, { steps: 2 })
        await page.mouse.up()

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        // Should move slightly to the right but not jump across the page
        expect(e.x - s.x).toBeGreaterThanOrEqual(1)
        expect(e.x - s.x).toBeLessThan(40)
        // y should remain effectively unchanged
        expect(Math.abs(e.y - s.y)).toBeLessThan(2)
    })
})
