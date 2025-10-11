import { expect, test } from '@playwright/test'

test.describe('drag/controls', () => {
    test('imperative start moves x only with dragControls', async ({ page }) => {
        await page.goto('/tests/drag/controls?@humanspeak-svelte-motion-isPlaywright=true')
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
})
