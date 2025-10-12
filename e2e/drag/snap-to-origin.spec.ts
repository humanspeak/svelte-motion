import { expect, test } from '@playwright/test'

test.describe('drag/snap-to-origin', () => {
    test('releases back to origin after drag', async ({ page }) => {
        await page.goto('/tests/drag/snap-to-origin?@humanspeak-svelte-motion-isPlaywright=true')

        const box = page.getByTestId('snap-origin-box')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // Drag to the right and slightly down
        await box.dispatchEvent('pointerdown', {
            clientX: start.x + start.width / 2,
            clientY: start.y + start.height / 2,
            pointerId: 71
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + start.width / 2 + 80,
            clientY: start.y + start.height / 2 + 20,
            pointerId: 71
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + start.width / 2 + 80,
            clientY: start.y + start.height / 2 + 20,
            pointerId: 71
        })

        // Wait for snap-to-origin settle
        await page.waitForTimeout(500)
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
        await page.goto('/tests/drag/snap-to-origin?@humanspeak-svelte-motion-isPlaywright=true')

        const box = page.getByTestId('snap-origin-box')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // First drag away and release
        await box.dispatchEvent('pointerdown', {
            clientX: start.x + start.width / 2,
            clientY: start.y + start.height / 2,
            pointerId: 72
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + start.width / 2 + 60,
            clientY: start.y + start.height / 2,
            pointerId: 72
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + start.width / 2 + 60,
            clientY: start.y + start.height / 2,
            pointerId: 72
        })

        // Wait for snap settle
        await page.waitForTimeout(600)
        const settled = await box.boundingBox()
        if (!settled) throw new Error('no settled')

        // Second drag: pointerdown at current center should not move the box
        await box.dispatchEvent('pointerdown', {
            clientX: settled.x + settled.width / 2,
            clientY: settled.y + settled.height / 2,
            pointerId: 73
        })
        const afterDown = await box.boundingBox()
        if (!afterDown) throw new Error('no afterDown')
        expect(Math.abs(afterDown.x - settled.x)).toBeLessThan(1.5)
        expect(Math.abs(afterDown.y - settled.y)).toBeLessThan(1.5)

        // Cleanup
        await page.dispatchEvent('body', 'pointerup', {
            clientX: afterDown.x + afterDown.width / 2,
            clientY: afterDown.y + afterDown.height / 2,
            pointerId: 73
        })
    })
})
