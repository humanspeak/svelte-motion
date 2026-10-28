import { expect, test, type Locator, type Page } from '@playwright/test'

// Motion 14.7 Timeline via useAnimate()'s scoped animate. Behaviour from upstream
// packages/framer-motion/src/animation/timeline/__tests__/timeline.test.ts @ v14.7.1.
test.describe('useAnimate timelines (Motion 14.7)', () => {
    const gotoReady = async (page: Page) => {
        await page.goto('/tests/useAnimate/timeline?@isPlaywright=true')
        await expect(page.getByTestId('stage')).toHaveAttribute('data-hydrated', 'true')
    }

    const translateX = (locator: Locator) =>
        locator.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)

    test('adding a segment at a label offset extends the duration', async ({ page }) => {
        await gotoReady(page)

        await expect(page.getByTestId('duration')).toHaveText('2.00')
        await page.getByTestId('add-c').click()
        await expect(page.getByTestId('duration')).toHaveText('2.50')
    })

    test('playTo() plays to a label and pauses', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('play-to-mid').click()
        await expect(page.getByTestId('state')).toHaveText('paused', { timeout: 2000 })
        await expect
            .poll(async () => Number(await page.getByTestId('time').textContent()), {
                timeout: 2000
            })
            .toBeGreaterThan(0.95)
        expect(Number(await page.getByTestId('time').textContent())).toBeCloseTo(1, 1)
        expect(await translateX(page.getByTestId('box-a'))).toBeCloseTo(200, 0)
        expect(await translateX(page.getByTestId('box-b'))).toBeCloseTo(0, 0)
    })

    test('play runs to the end and reverse brings everything back', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('add-c').click()
        await page.getByTestId('play').click()
        await expect(page.getByTestId('completed')).toHaveText('1', { timeout: 3000 })
        expect(await translateX(page.getByTestId('box-c'))).toBeCloseTo(200, 0)

        await page.getByTestId('reverse').click()
        await expect(page.getByTestId('completed')).toHaveText('2', { timeout: 4000 })
        for (const id of ['box-a', 'box-b', 'box-c']) {
            expect(await translateX(page.getByTestId(id))).toBeCloseTo(0, 0)
        }
    })
})
