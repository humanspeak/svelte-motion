import { expect, test } from '@playwright/test'

test.describe('drag/momentum', () => {
    test('continues moving after release', async ({ page }) => {
        await page.goto('/tests/drag/momentum?@isPlaywright=true')
        const el = page.getByTestId('drag-momentum')
        await el.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        // Use Playwright's mouse API with multiple moves to generate velocity
        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.waitForTimeout(20)
        await page.mouse.move(s.x + 60, s.y + 10, { steps: 3 })
        await page.waitForTimeout(20)
        await page.mouse.move(s.x + 120, s.y + 10, { steps: 3 })
        await page.mouse.up()

        const baseline = await el.boundingBox()
        if (!baseline) throw new Error('no baseline')
        const samples: number[] = []
        for (let i = 0; i < 12; i++) {
            await page.waitForTimeout(50)
            const bb = await el.boundingBox()
            if (bb) samples.push(bb.x)
        }
        const maxDelta = Math.max(...samples.map((x) => x - baseline.x))
        expect(maxDelta).toBeGreaterThan(40)
    })
})
