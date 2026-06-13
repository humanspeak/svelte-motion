import { expect, test } from '@playwright/test'

import { readTranslate } from '../_helpers/transform'

test.describe('drag/snap-to-origin', () => {
    test('release animates back to origin instead of snapping instantly', async ({ page }) => {
        await page.goto('/tests/drag/snap-to-origin?@isPlaywright=true')

        const box = page.getByTestId('snap-origin-box')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 120, cy + 60, { steps: 8 })
        const released = await readTranslate(page, '[data-testid="snap-origin-box"]')
        await page.mouse.up()

        await page.waitForTimeout(80)
        const mid = await readTranslate(page, '[data-testid="snap-origin-box"]')

        expect(released.tx).toBeGreaterThan(20)
        expect(released.ty).toBeGreaterThan(8)
        expect(mid.tx).toBeGreaterThan(4)
        expect(mid.ty).toBeGreaterThan(2)
        expect(mid.tx).toBeLessThan(released.tx - 2)
        expect(mid.ty).toBeLessThan(released.ty - 1)
    })

    test('releases back to origin after drag', async ({ page }) => {
        await page.goto('/tests/drag/snap-to-origin?@isPlaywright=true')

        const box = page.getByTestId('snap-origin-box')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // Drag to the right and slightly down using mouse API
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
        await page.mouse.down()
        await page.mouse.move(start.x + start.width / 2 + 80, start.y + start.height / 2 + 20, {
            steps: 5
        })
        await page.mouse.up()

        // Wait for the upstream inertia-style snap-to-origin settle.
        await page.waitForTimeout(1200)
        const after = await box.boundingBox()
        if (!after) throw new Error('no after')

        // Should return close to original center
        const sx = start.x + start.width / 2
        const sy = start.y + start.height / 2
        const ax = after.x + after.width / 2
        const ay = after.y + after.height / 2
        expect(Math.abs(ax - sx)).toBeLessThan(2)
        expect(Math.abs(ay - sy)).toBeLessThan(2)
    })

    test('second drag starts from correct position with no jump', async ({ page }) => {
        await page.goto('/tests/drag/snap-to-origin?@isPlaywright=true')

        const box = page.getByTestId('snap-origin-box')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // First drag away and release using mouse API
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
        await page.mouse.down()
        await page.mouse.move(start.x + start.width / 2 + 60, start.y + start.height / 2, {
            steps: 5
        })
        await page.mouse.up()

        // Wait for snap settle
        await page.waitForTimeout(600)
        const settled = await box.boundingBox()
        if (!settled) throw new Error('no settled')

        // Second drag: pointerdown at current center should not move the box
        await page.mouse.move(settled.x + settled.width / 2, settled.y + settled.height / 2)
        await page.mouse.down()

        const afterDown = await box.boundingBox()
        if (!afterDown) throw new Error('no afterDown')
        expect(Math.abs(afterDown.x - settled.x)).toBeLessThan(1.5)
        expect(Math.abs(afterDown.y - settled.y)).toBeLessThan(1.5)

        // Cleanup
        await page.mouse.up()
    })
})
