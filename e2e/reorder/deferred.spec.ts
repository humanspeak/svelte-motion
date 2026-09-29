import { expect, test } from '@playwright/test'

type ReorderWindow = Window & { reorderCalls: string[]; dragDone: boolean }

/**
 * Port of upstream Motion's `cypress/integration/reorder-transition.ts`:
 * Reorder.Group must not call onReorder again with the same order while the
 * previous order is still pending (applied asynchronously by the consumer).
 */
test.describe('reorder/deferred', () => {
    test('calls onReorder once per new order (deferred apply)', async ({ page }) => {
        await page.goto('/tests/reorder/deferred?@isPlaywright=true')
        await page.locator('#item-0').waitFor({ state: 'visible' })

        await page.locator('#drag').click()
        await page.waitForFunction(
            () => (window as unknown as ReorderWindow).dragDone === true,
            undefined,
            { timeout: 10000 }
        )

        const calls = await page.evaluate(() => (window as unknown as ReorderWindow).reorderCalls)
        expect(calls.length).toBeGreaterThan(0)
        // The drag crosses at most 3 rows.
        expect(calls.length).toBeLessThanOrEqual(3)
        for (let i = 1; i < calls.length; i++) {
            expect(calls[i]).not.toBe(calls[i - 1])
        }
    })
})
