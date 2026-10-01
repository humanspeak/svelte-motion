import { expect, test } from '@playwright/test'

const URL = '/tests/animate-presence/boundary-teardown?@isPlaywright=true'

for (const mode of ['sync', 'wait', 'popLayout']) {
    test.describe(`AnimatePresence boundary teardown (${mode})`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(URL)
            await page.getByRole('combobox', { name: 'Presence mode' }).selectOption(mode)
            await expect(page.getByTestId('teardown-card')).toBeVisible()
        })

        for (const exiting of [false, true]) {
            test(`navigation removes ${exiting ? 'an active exit' : 'a present child'} immediately`, async ({
                page
            }) => {
                // A retained window value proves this was SvelteKit client navigation.
                await page.evaluate(() => {
                    Object.assign(window, { teardownNavigationMarker: true })
                })
                if (exiting) {
                    await page.getByRole('button', { name: 'Hide card', exact: true }).click()
                    await expect(page.locator('[data-clone="true"]')).toHaveCount(1)
                }

                await page.getByRole('link', { name: 'Navigate away' }).click()
                await expect(
                    page.getByRole('heading', { name: 'Boundary teardown destination' })
                ).toBeVisible()

                // Read once instead of polling until the two-second exit finishes.
                expect(
                    await page.evaluate(() => ({
                        clientNavigation: Reflect.get(window, 'teardownNavigationMarker'),
                        clones: document.querySelectorAll('[data-clone="true"]').length,
                        placeholders: document.querySelectorAll(
                            '[data-presence-placeholder="true"]'
                        ).length
                    }))
                ).toEqual({ clientNavigation: true, clones: 0, placeholders: 0 })
            })

            test(`boundary removal cancels ${exiting ? 'an active exit' : 'a present child'}`, async ({
                page
            }) => {
                if (exiting) {
                    await page.getByRole('button', { name: 'Hide card', exact: true }).click()
                    await expect(page.locator('[data-clone="true"]')).toHaveCount(1)
                }

                await page.getByRole('button', { name: 'Remove boundary' }).click()
                expect(
                    await page
                        .locator('[data-clone="true"], [data-presence-placeholder="true"]')
                        .count()
                ).toBe(0)
                await expect(page.getByTestId('teardown-card')).toHaveCount(0)

                // Cross a frame so a queued animation start cannot recreate the exit.
                await page.evaluate(
                    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                )
                expect(await page.locator('[data-clone="true"]').count()).toBe(0)
                await expect(page.getByTestId('completed-exits')).toHaveText('0')
            })
        }

        test('a child-only removal still completes its exit', async ({ page }) => {
            await page.getByRole('button', { name: 'Hide card', exact: true }).click()
            await expect(page.locator('[data-clone="true"]')).toHaveCount(1)
            await expect(page.locator('[data-clone="true"]')).toHaveCount(0, { timeout: 5000 })
            await expect(page.locator('[data-presence-placeholder="true"]')).toHaveCount(0)
            await expect(page.getByTestId('completed-exits')).toHaveText('1')
        })
    })
}

test('links the teardown demo from the test index', async ({ page }) => {
    await page.goto('/?@isPlaywright=true')
    await expect(
        page.getByRole('link', { name: 'Boundary teardown and navigation' })
    ).toHaveAttribute('href', /\/tests\/animate-presence\/boundary-teardown/)
})

test('the destination links back to the teardown demo', async ({ page }) => {
    await page.goto('/tests/animate-presence/boundary-teardown/destination')
    await page.getByRole('link', { name: 'Back to boundary teardown' }).click()
    await expect(
        page.getByRole('heading', { name: 'AnimatePresence boundary teardown' })
    ).toBeVisible()
})

test('reset restores a removed boundary for another comparison', async ({ page }) => {
    await page.goto(URL)
    await page.getByRole('button', { name: 'Remove boundary' }).click()
    await expect(page.getByText('Everything cleared immediately.')).toBeVisible()
    await page.getByRole('button', { name: 'Reset demo' }).click()
    await expect(page.getByTestId('teardown-card')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hide card', exact: true })).toBeEnabled()
    await expect(page.getByTestId('completed-exits')).toHaveText('0')
    expect(await page.locator('[data-clone="true"]').count()).toBe(0)
})
