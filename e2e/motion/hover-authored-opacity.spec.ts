import { expect, test } from '@playwright/test'

const URL = '/tests/motion/hover-authored-opacity?@isPlaywright=true'

const readOpacity = (page: import('@playwright/test').Page) =>
    page
        .getByTestId('motion-hover-authored-opacity')
        .evaluate((el) => parseFloat(getComputedStyle(el).opacity))

test.describe('motion/whileHover over style-authored opacity', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('motion-hover-authored-opacity').waitFor({ state: 'visible' })
    })

    test('hover-leave restores the style-authored opacity, not the neutral default', async ({
        page
    }) => {
        const card = page.getByTestId('motion-hover-authored-opacity')

        // Authored baseline: opacity: 0.8 from the style prop.
        expect(await readOpacity(page)).toBeCloseTo(0.8, 1)

        // Hover: animates toward opacity 1.
        await card.hover()
        await expect.poll(() => readOpacity(page), { timeout: 3000 }).toBeGreaterThan(0.97)

        // Leave: move the pointer well away from the card.
        await page.mouse.move(4, 4)

        // Must settle back on the authored 0.8, not the neutral default 1.
        await expect.poll(() => readOpacity(page), { timeout: 3000 }).toBeLessThan(0.83)

        const settled = await readOpacity(page)
        expect(
            Math.abs(settled - 0.8),
            `settled opacity: ${settled.toFixed(3)} (authored 0.8)`
        ).toBeLessThan(0.02)
    })
})
