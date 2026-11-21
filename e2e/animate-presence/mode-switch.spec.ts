import { expect, test } from '@playwright/test'

const URL = '/tests/animate-presence/mode-switch?@isPlaywright=true'

test.describe('AnimatePresence runtime mode switch', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('mode-card')).toBeVisible()
    })

    const selectMode = (page: import('@playwright/test').Page, mode: string) =>
        page.getByRole('combobox', { name: 'Presence mode' }).selectOption(mode)
    const swap = (page: import('@playwright/test').Page) =>
        page.getByRole('button', { name: 'Swap card' }).click()
    const clone = (page: import('@playwright/test').Page) => page.locator('[data-clone="true"]')
    const cardB = (page: import('@playwright/test').Page) =>
        page.locator('[data-testid="mode-card"][data-card="b"]:not([data-clone])')

    test('changing mode does not remount the present card', async ({ page }) => {
        await page
            .getByTestId('mode-card')
            .evaluate((el) => ((el as HTMLElement).dataset.marked = '1'))
        await selectMode(page, 'wait')
        await selectMode(page, 'popLayout')
        await expect(page.getByTestId('mode-card')).toHaveAttribute('data-marked', '1')
        await expect(clone(page)).toHaveCount(0)
    })

    test('an exit after switching to wait waits', async ({ page }) => {
        await selectMode(page, 'wait')
        await swap(page)
        await expect(clone(page)).toHaveAttribute('data-mode', 'wait')
        await expect(cardB(page)).not.toBeVisible()
        await expect(clone(page)).toHaveCount(0, { timeout: 5000 })
        await expect(cardB(page)).toBeVisible()
    })

    test('an exit after switching to popLayout pops', async ({ page }) => {
        await selectMode(page, 'popLayout')
        await swap(page)
        await expect(clone(page)).toHaveAttribute('data-mode', 'popLayout')
        await expect(page.locator('[data-presence-placeholder="true"]')).toHaveCount(0)
    })

    test('an exit in flight keeps its mode', async ({ page }) => {
        await swap(page)
        await expect(clone(page)).toHaveCount(1)
        await selectMode(page, 'wait')
        await expect(clone(page)).toHaveAttribute('data-mode', 'sync')
        await expect(cardB(page)).toBeVisible()
        await expect(page.getByTestId('completed-exits')).toHaveText('1', { timeout: 5000 })
    })

    test('a held enter is released when the exit ends after switching to sync', async ({
        page
    }) => {
        await selectMode(page, 'wait')
        await swap(page)
        await expect(clone(page)).toHaveCount(1)
        await selectMode(page, 'sync')
        await expect(clone(page)).toHaveCount(1)
        await expect(cardB(page)).not.toBeVisible()
        await expect(clone(page)).toHaveCount(0, { timeout: 5000 })
        await expect(cardB(page)).toBeVisible()
    })

    test('the index links the page', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: 'Runtime mode switch' })).toHaveAttribute(
            'href',
            /\/tests\/animate-presence\/mode-switch/
        )
    })
})
