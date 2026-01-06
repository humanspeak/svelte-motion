import { expect, test } from '@playwright/test'

test.describe('drag/basic', () => {
    test('moves when dragged', async ({ page }) => {
        await page.goto('/tests/drag/basic?@isPlaywright=true')
        const box = page.getByTestId('drag-box')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // Use Playwright's mouse API for reliable cross-platform behavior
        await page.mouse.move(start.x + 10, start.y + 10)
        await page.mouse.down()
        await page.mouse.move(start.x + 80, start.y + 40, { steps: 5 })
        await page.mouse.up()

        const end = await box.boundingBox()
        if (!end) throw new Error('no end')
        expect(end.x).toBeGreaterThan(start.x + 20)
    })

    test('has momentum after release', async ({ page }) => {
        await page.goto('/tests/drag/basic?@isPlaywright=true')
        const box = page.getByTestId('drag-box')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // Use mouse API with delays to generate velocity for momentum
        await page.mouse.move(start.x + 10, start.y + 10)
        await page.mouse.down()
        await page.waitForTimeout(40)
        await page.mouse.move(start.x + 60, start.y + 20, { steps: 3 })
        await page.waitForTimeout(40)
        await page.mouse.move(start.x + 90, start.y + 30, { steps: 3 })
        await page.mouse.up()

        const baseline = await box.boundingBox()
        if (!baseline) throw new Error('no baseline')

        const samples: number[] = []
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(50)
            const bb = await box.boundingBox()
            if (bb) samples.push(bb.x)
        }
        const maxDelta = Math.max(...samples.map((x) => x - baseline.x))
        expect(maxDelta).toBeGreaterThan(30)
    })

    test('second drag starts from transformed position', async ({ page }) => {
        await page.goto('/tests/drag/basic?@isPlaywright=true')
        const box = page.getByTestId('drag-box')
        await box.waitFor({ state: 'visible' })
        const s = await box.boundingBox()
        if (!s) throw new Error('no s')

        // First drag
        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.mouse.move(s.x + 80, s.y + 40, { steps: 5 })
        await page.mouse.up()

        // Wait for position to stabilize before starting the second drag (CI flake guard)
        let lastX = NaN
        let stable = 0
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(50)
            const bb = await box.boundingBox()
            if (!bb) continue
            if (!Number.isNaN(lastX) && Math.abs(bb.x - lastX) < 0.5) {
                stable++
                if (stable >= 3) break
            } else {
                stable = 0
            }
            lastX = bb.x
        }

        const mid = await box.boundingBox()
        if (!mid) throw new Error('no mid')

        // Second drag
        await page.mouse.move(mid.x + 10, mid.y + 10)
        await page.mouse.down()
        await page.mouse.move(mid.x + 40, mid.y + 30, { steps: 5 })
        await page.mouse.up()

        const end = await box.boundingBox()
        if (!end) throw new Error('no end')
        expect(end.x - mid.x).toBeGreaterThan(10)
    })
})
