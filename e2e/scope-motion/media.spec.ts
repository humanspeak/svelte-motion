import { expect, test } from '@playwright/test'
import { waitForSettledTransform } from '../_helpers/transform'

const BOX = '[data-testid="box"]'

test.describe('scope-motion/media', () => {
    test('refreshes the scope when a media condition flips', async ({ page }) => {
        await page.setViewportSize({ width: 1000, height: 600 })
        await page.goto('/tests/scope-motion/media?@isPlaywright=true')

        await expect(page.getByTestId('media')).toHaveText('desktop')
        await expect(page.getByTestId('media-json')).toHaveText('{"desktop":true,"mobile":false}')
        await waitForSettledTransform(page, BOX, { tx: 200, ty: 0 }, 1)
        const runsOnLoad = Number(await page.getByTestId('runs').textContent())
        expect(runsOnLoad).toBe(1)

        await page.setViewportSize({ width: 600, height: 600 })
        await expect(page.getByTestId('media')).toHaveText('mobile')
        await expect(page.getByTestId('media-json')).toHaveText('{"desktop":false,"mobile":true}')
        await waitForSettledTransform(page, BOX, { tx: 50, ty: 0 }, 1)
        const runsOnMobile = Number(await page.getByTestId('runs').textContent())
        expect(runsOnMobile).toBeGreaterThan(runsOnLoad)

        await page.setViewportSize({ width: 1000, height: 600 })
        await expect(page.getByTestId('media')).toHaveText('desktop')
        await waitForSettledTransform(page, BOX, { tx: 200, ty: 0 }, 1)
        // Setup re-ran for the flip back. Not pinned to an exact count: each
        // flip changes both conditions, and Chromium can deliver their
        // `change` events with a microtask checkpoint between them, so
        // motion-dom may refresh once per condition.
        expect(Number(await page.getByTestId('runs').textContent())).toBeGreaterThan(runsOnMobile)
    })
})
