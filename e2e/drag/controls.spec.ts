import { expect, test } from '@playwright/test'

test.describe('drag/controls', () => {
    test('imperative start moves x only with dragControls', async ({ page }) => {
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await handle.dispatchEvent('pointerdown', {
            clientX: s.x - 20,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 60,
            clientY: s.y + 40,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 60,
            clientY: s.y + 40,
            pointerId: 1
        })
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.x).toBeGreaterThan(s.x + 10)
        expect(Math.abs(e.y - s.y)).toBeLessThan(5)
    })

    test('tiny right nudge does NOT teleport on x-only dragControls', async ({ page }) => {
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        await handle.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 2
        })
        // micro nudge on x
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 12,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 12,
            clientY: s.y + 10,
            pointerId: 2
        })

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        // Should move slightly to the right but not jump across the page
        expect(e.x - s.x).toBeGreaterThanOrEqual(1)
        expect(e.x - s.x).toBeLessThan(40)
        // y should remain effectively unchanged
        expect(Math.abs(e.y - s.y)).toBeLessThan(2)
    })
})
