import { expect, test } from '@playwright/test'

const URL = '/tests/animate-presence/clone-fidelity?@isPlaywright=true'

test.describe('AnimatePresence clone fidelity', () => {
    test('PresenceChild runs a motion child exit on the real node', async ({ page }) => {
        await page.goto(URL)
        const child = page.getByTestId('presence-child-motion')
        await expect(child).toBeVisible()

        await page.getByTestId('presence-child-toggle').click()
        await expect(child).toHaveCount(1)
        await page.waitForTimeout(120)

        const opacity = await child.evaluate((node) =>
            Number.parseFloat(getComputedStyle(node).opacity)
        )
        expect(opacity).toBeLessThan(0.95)
        await expect(child).toHaveCount(0)
        await expect(page.getByTestId('presence-child-exit-count')).toHaveText('1')
    })

    test('marks an interactive exit clone inert and aria-hidden', async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('interactive-clone-hide').click()

        const clone = page.locator('[data-clone="true"]')
        await expect(clone).toHaveCount(1)
        await expect(clone).toHaveAttribute('aria-hidden', 'true')
        expect(await clone.evaluate((node) => (node as HTMLElement).inert)).toBe(true)
    })

    test('does not create a blank clone for a canvas subtree', async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('stateful-canvas')).toBeVisible()

        await page.getByTestId('canvas-card-hide').click()

        await expect(page.getByTestId('canvas-card')).toHaveCount(0)
        await expect(page.locator('[data-clone="true"]')).toHaveCount(0)
        await expect(page.locator('[data-presence-placeholder="true"]')).toHaveCount(0)
    })

    test('keeps the fidelity harness linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'Clone fidelity (PresenceChild, a11y, media)' })
        ).toHaveAttribute('href', /\/tests\/animate-presence\/clone-fidelity/)
    })
})
