import { expect, test } from '@playwright/test'

test.describe('drag/axis-y', () => {
    test('guide is behind box per z-index', async ({ page }) => {
        await page.goto('/tests/drag/axis-y?@humanspeak-svelte-motion-isPlaywright=true')
        const guideZ = await page
            .getByTestId('axis-guide')
            .evaluate((el) => getComputedStyle(el).zIndex)
        const boxZ = await page.getByTestId('drag-y').evaluate((el) => getComputedStyle(el).zIndex)
        expect(parseInt(guideZ || '0')).toBeLessThan(parseInt(boxZ || '0'))
    })
    test('moves on y but not x', async ({ page }) => {
        await page.goto('/tests/drag/axis-y?@humanspeak-svelte-motion-isPlaywright=true')
        const el = page.getByTestId('drag-y')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 60,
            clientY: s.y + 80,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 60,
            clientY: s.y + 80,
            pointerId: 1
        })
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.y).toBeGreaterThan(s.y + 20)
        expect(Math.abs(e.x - s.x)).toBeLessThan(5)
    })
})
