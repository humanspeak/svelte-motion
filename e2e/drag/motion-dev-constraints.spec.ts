import { expect, test } from '@playwright/test'

test.describe('drag/motion-dev-constraints', () => {
    test('renders a Motion.dev-style constrained drag example', async ({ page }) => {
        await page.goto('/tests/drag/motion-dev-constraints?@isPlaywright=true')

        const card = page.getByTestId('motion-dev-drag-card')
        const bounds = page.getByTestId('motion-dev-constraint-box')
        await card.waitFor({ state: 'visible' })
        await bounds.waitFor({ state: 'visible' })

        const start = await card.boundingBox()
        const box = await bounds.boundingBox()
        if (!start) throw new Error('missing drag card bounds')
        if (!box) throw new Error('missing constraint bounds')

        const startX = start.x + start.width / 2
        const startY = start.y + start.height / 2
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX + 180, startY + 90, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(900)

        const settled = await card.boundingBox()
        if (!settled) throw new Error('missing settled drag card bounds')

        expect(settled.x).toBeGreaterThanOrEqual(box.x - 1)
        expect(settled.y).toBeGreaterThanOrEqual(box.y - 1)
        expect(settled.x + settled.width).toBeLessThanOrEqual(box.x + box.width + 1)
        expect(settled.y + settled.height).toBeLessThanOrEqual(box.y + box.height + 1)
    })
})
