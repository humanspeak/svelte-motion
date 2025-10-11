import { expect, test } from '@playwright/test'

test.describe('drag/elastic', () => {
    test('elastic=0 clamps exactly to ±30', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@humanspeak-svelte-motion-isPlaywright=true')
        const el = page.getByTestId('elastic-0')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.waitForTimeout(200)
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        const dx = Math.round(e.x - s.x)
        expect(dx).toBeGreaterThanOrEqual(28)
        expect(dx).toBeLessThanOrEqual(32)
    })

    test('second drag clamps from new origin', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@humanspeak-svelte-motion-isPlaywright=true')
        const el = page.getByTestId('elastic-0')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.waitForTimeout(200)
        const mid = await el.boundingBox()
        if (!mid) throw new Error('no mid')

        await el.dispatchEvent('pointerdown', {
            clientX: mid.x + 10,
            clientY: mid.y + 10,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: mid.x + 300,
            clientY: mid.y + 10,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: mid.x + 300,
            clientY: mid.y + 10,
            pointerId: 3
        })
        await page.waitForTimeout(200)
        const end = await el.boundingBox()
        if (!end) throw new Error('no end')
        const dx = Math.round(end.x - mid.x)
        expect(dx).toBeGreaterThanOrEqual(28)
        expect(dx).toBeLessThanOrEqual(32)
    })
})
