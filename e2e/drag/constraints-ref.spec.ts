import { expect, test } from '@playwright/test'

test.describe('drag/constraints-ref', () => {
    test('is constrained inside container ref', async ({ page }) => {
        await page.goto('/tests/drag/constraints-ref?@humanspeak-svelte-motion-isPlaywright=true')
        const el = page.getByTestId('drag-ref')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 300,
            clientY: s.y - 300,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 300,
            clientY: s.y - 300,
            pointerId: 1
        })
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        // Should not move wildly; still within ref bounds around the original area
        expect(e.x - s.x).toBeLessThan(260)
        expect(s.y - e.y).toBeLessThan(260)
    })
})
