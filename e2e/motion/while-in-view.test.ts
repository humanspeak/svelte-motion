import { expect, test } from '@playwright/test'

test.describe('whileInView', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/motion/while-in-view')
    })

    test('element already in viewport animates on initial render', async ({ page }) => {
        const box = page.getByTestId('in-viewport-box')
        await expect(box).toBeVisible()

        // Element should animate to full opacity since it's already in viewport
        await expect
            .poll(
                async () => {
                    const opacity = await box.evaluate((el) =>
                        parseFloat(getComputedStyle(el).opacity)
                    )
                    return opacity
                },
                { timeout: 3000 }
            )
            .toBeGreaterThanOrEqual(0.99)

        // Verify the data-animated attribute is set (animation completed)
        await expect(box).toHaveAttribute('data-animated', 'true')
    })

    test('element below fold does not animate until scrolled into view', async ({ page }) => {
        // Ensure we're at the top of the page
        await page.evaluate(() => window.scrollTo(0, 0))

        const belowFoldBox = page.getByTestId('below-fold-box')

        // Wait for page to settle and animations to complete
        await page.waitForTimeout(500)

        // Check element's position to verify it's below fold
        const rect = await belowFoldBox.evaluate((el) => {
            const r = el.getBoundingClientRect()
            return {
                top: r.top,
                viewportHeight: window.innerHeight
            }
        })

        // Verify element is actually below the fold
        expect(rect.top).toBeGreaterThan(rect.viewportHeight)

        // The key test: whileInView should NOT have triggered for element below fold
        await expect(belowFoldBox).toHaveAttribute('data-inview-triggered', 'false')
    })

    test('element below fold animates when scrolled into view', async ({ page }) => {
        const belowFoldBox = page.getByTestId('below-fold-box')

        // Verify whileInView hasn't triggered yet
        await expect(belowFoldBox).toHaveAttribute('data-inview-triggered', 'false')

        // Scroll the element into view
        await belowFoldBox.scrollIntoViewIfNeeded()

        // Wait for whileInView to trigger
        await expect(belowFoldBox).toHaveAttribute('data-inview-triggered', 'true', {
            timeout: 3000
        })

        // Element should animate to full opacity after scrolling into view
        await expect
            .poll(
                async () => {
                    const opacity = await belowFoldBox.evaluate((el) =>
                        parseFloat(getComputedStyle(el).opacity)
                    )
                    return opacity
                },
                { timeout: 3000 }
            )
            .toBeGreaterThanOrEqual(0.99)
    })

    test('element below fold also scales when scrolled into view', async ({ page }) => {
        const belowFoldBox = page.getByTestId('below-fold-box')

        // Get scale value from transform
        const getScale = async (): Promise<number> => {
            return await belowFoldBox.evaluate((el) => {
                const transform = getComputedStyle(el).transform
                if (transform === 'none') return 1

                // Parse matrix(a, b, c, d, tx, ty) - scale is in 'a' position
                const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
                if (matrixMatch) {
                    const values = matrixMatch[1].split(',').map((v) => parseFloat(v.trim()))
                    return values[0] // scaleX
                }
                return 1
            })
        }

        // Verify whileInView hasn't triggered yet
        await expect(belowFoldBox).toHaveAttribute('data-inview-triggered', 'false')

        // Scroll into view
        await belowFoldBox.scrollIntoViewIfNeeded()

        // Wait for whileInView to trigger
        await expect(belowFoldBox).toHaveAttribute('data-inview-triggered', 'true', {
            timeout: 3000
        })

        // Scale should animate to 1 (whileInView target)
        await expect
            .poll(async () => await getScale(), { timeout: 3000 })
            .toBeGreaterThanOrEqual(0.99)
    })
})
