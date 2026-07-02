import { expect, test } from '@playwright/test'
import { waitForViewAnimation } from '../_helpers/view'

declare global {
    interface Window {
        __vtCalls?: number
    }
}

test.describe('view/basic', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/view/basic?@isPlaywright=true')
        await page.getByTestId('toggle').waitFor({ state: 'visible' })
    })

    test('runs the update through a real View Transition', async ({ page }) => {
        // Chromium supports the View Transitions API — assert we actually
        // use it rather than falling back to an instant swap.
        await page.evaluate(() => {
            window.__vtCalls = 0
            const original = document.startViewTransition.bind(document)
            document.startViewTransition = ((callback: () => Promise<void>) => {
                window.__vtCalls = (window.__vtCalls ?? 0) + 1
                return original(callback)
            }) as typeof document.startViewTransition
        })

        await page.getByTestId('toggle').click()

        // Mid-transition, view-transition pseudo-element animations exist
        // (throws with timeout diagnostics if none appears).
        await waitForViewAnimation(page)

        await expect(page.getByTestId('stats')).toHaveText('transitions:1 settled:1')
        await expect(page.getByTestId('mode')).toHaveText('dark')
        expect(await page.evaluate(() => window.__vtCalls)).toBe(1)
    })

    test('queues rapid toggles and settles on the final state', async ({ page }) => {
        const toggle = page.getByTestId('toggle')
        await toggle.click()
        await toggle.click()
        await toggle.click()

        // interrupt: 'wait' queues the transitions; all three must settle.
        await expect(page.getByTestId('stats')).toHaveText('transitions:3 settled:3', {
            timeout: 10000
        })
        await expect(page.getByTestId('mode')).toHaveText('dark')
    })
})
