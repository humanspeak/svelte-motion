import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Plan 014: Motion's public, framework-agnostic API re-exported unchanged.
 * The only real-browser coverage for animateMini (Web Animations) and for
 * inertia's boundary spring as painted.
 */
test.describe('Motion re-exports', () => {
    const gotoReady = async (page: Page) => {
        await page.goto('/tests/motion-reexports?@isPlaywright=true')
        await expect(page.getByTestId('stage')).toHaveAttribute('data-hydrated', 'true')
    }

    const translateX = (locator: Locator) =>
        locator.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)

    test('createScopedAnimate: selectors resolve only inside the scope', async ({ page }) => {
        await gotoReady(page)
        await page.getByTestId('run-scoped').click()

        for (const i of [0, 1, 2]) {
            await expect
                .poll(() => translateX(page.getByTestId(`dot-a-${i}`)), { timeout: 2000 })
                .toBeCloseTo(100, 0)
        }
        for (const i of [0, 1, 2]) {
            expect(Math.abs(await translateX(page.getByTestId(`dot-b-${i}`)))).toBeLessThanOrEqual(
                1
            )
        }
    })

    test('inertia: the fling settles at the max boundary', async ({ page }) => {
        await gotoReady(page)
        await page.getByTestId('fling').click()

        await expect(page.getByTestId('ball-x')).toHaveText('240', { timeout: 4000 })
        await expect
            .poll(async () => Math.abs((await translateX(page.getByTestId('ball'))) - 240), {
                timeout: 4000
            })
            .toBeLessThanOrEqual(2)
    })

    test('animateMini: fades the box through Web Animations', async ({ page }) => {
        await gotoReady(page)
        await page.getByTestId('run-mini').click()

        await expect(page.getByTestId('mini-running')).toHaveText('true')
        await expect
            .poll(
                async () =>
                    Math.abs(
                        Number(
                            await page
                                .getByTestId('mini-box')
                                .evaluate((el) => getComputedStyle(el).opacity)
                        ) - 0.25
                    ),
                { timeout: 2000 }
            )
            .toBeLessThanOrEqual(0.02)
    })

    test('resolveElements: whole section vs scoped list', async ({ page }) => {
        await gotoReady(page)

        await expect(page.getByTestId('resolve-doc')).toHaveText('5')
        await expect(page.getByTestId('resolve-scoped')).toHaveText('2')
    })
})
