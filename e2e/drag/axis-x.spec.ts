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
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 80,
            clientY: s.y + 60,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 80,
            clientY: s.y + 60,
            pointerId: 1
        })
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.x).toBeGreaterThan(s.x + 20)
        expect(Math.abs(e.y - s.y)).toBeLessThan(5)
    })

    test('second drag respects x-only', async ({ page }) => {
        await page.goto('/tests/drag/axis-x?@isPlaywright=true')
        const el = page.getByTestId('drag-x')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 60,
            clientY: s.y + 0,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 60,
            clientY: s.y + 0,
            pointerId: 2
        })
        const m = await el.boundingBox()
        if (!m) throw new Error('no m')
        await el.dispatchEvent('pointerdown', {
            clientX: m.x + 10,
            clientY: m.y + 10,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: m.x + 30,
            clientY: m.y + 40,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: m.x + 30,
            clientY: m.y + 40,
            pointerId: 3
        })
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.x - m.x).toBeGreaterThan(10)
        expect(Math.abs(e.y - m.y)).toBeLessThan(5)
    })
})
