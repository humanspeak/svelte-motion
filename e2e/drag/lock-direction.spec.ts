import { expect, test } from '@playwright/test'

test.describe('drag/lock-direction', () => {
    test('random jitter after axis pull still settles at center', async ({ page }) => {
        await page.goto('/tests/drag/lock-direction?@isPlaywright=true')

        // Select container and draggable box
        const container = page.getByTestId('lock-container')
        const box = page.getByTestId('lock-box')
        await box.waitFor({ state: 'visible' })

        const containerBB = await container.boundingBox()
        const startBB = await box.boundingBox()
        if (!containerBB || !startBB) throw new Error('Missing bounding boxes')

        const containerCenter = {
            x: containerBB.x + containerBB.width / 2,
            y: containerBB.y + containerBB.height / 2
        }

        const TRIALS = 6
        for (let i = 0; i < TRIALS; i++) {
            const bb = await box.boundingBox()
            if (!bb) throw new Error('Missing box bounding box')

            // Start near the box center
            const down = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }
            await page.mouse.move(down.x, down.y)
            await page.mouse.down()

            // Choose an axis to pull strongly to engage direction lock
            const pullX = Math.random() < 0.5
            const pullDistance = 220
            const pull = {
                x: down.x + (pullX ? (Math.random() < 0.5 ? -1 : 1) * pullDistance : 0),
                y: down.y + (!pullX ? (Math.random() < 0.5 ? -1 : 1) * pullDistance : 0)
            }
            await page.mouse.move(pull.x, pull.y, { steps: 5 })

            // Inject random jitter across both axes
            const JITTER = 15
            for (let j = 0; j < 10; j++) {
                const jx = pull.x + (Math.random() - 0.5) * 2 * JITTER
                const jy = pull.y + (Math.random() - 0.5) * 2 * JITTER
                await page.mouse.move(jx, jy)
            }

            await page.mouse.up()

            // Wait for momentum + spring settle
            await page.waitForTimeout(800)

            const settled = await box.boundingBox()
            if (!settled) throw new Error('Missing settled bounding box')
            const center = { x: settled.x + settled.width / 2, y: settled.y + settled.height / 2 }

            // Should land back at container center within tight tolerance
            const dx = Math.abs(center.x - containerCenter.x)
            const dy = Math.abs(center.y - containerCenter.y)

            expect(dx).toBeLessThan(2)
            expect(dy).toBeLessThan(2)
        }
    })
})
