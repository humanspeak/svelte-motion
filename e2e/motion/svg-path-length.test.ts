import { expect, test } from '@playwright/test'

test.describe('SVG pathLength Animation', () => {
    test('should animate pathLength from 0 to 1 using strokeDasharray and strokeDashoffset', async ({
        page
    }) => {
        await page.goto('/tests/motion/svg-path-length')

        const path = page.getByTestId('animated-path')
        await expect(path).toBeVisible()

        // Wait for page to be fully loaded and animation to start
        await page.waitForTimeout(100)

        /**
         * pathLength animation should be implemented by Motion library using:
         * - Setting pathLength="1" attribute on the SVG path element
         * - Animating strokeDasharray from "0 1" to "1 1"
         * - This creates the line-drawing effect
         */

        const getStrokeDasharray = async (): Promise<string> =>
            await path.evaluate((el) => {
                const computed = getComputedStyle(el)
                return computed.strokeDasharray || el.getAttribute('stroke-dasharray') || 'none'
            })

        const getPathLengthAttr = async (): Promise<string | null> =>
            await path.evaluate((el) => el.getAttribute('pathLength'))

        // Initially, the path should have pathLength attribute set to "1" for normalization
        await expect
            .poll(async () => await getPathLengthAttr(), {
                message: 'pathLength attribute should be set to "1" for normalization',
                timeout: 1000
            })
            .toBe('1')

        // Initially, strokeDasharray should represent 0% drawn (approximately "0 1" or similar)
        await expect
            .poll(
                async () => {
                    const dasharray = await getStrokeDasharray()
                    if (dasharray === 'none') return false
                    // Parse the dasharray value - should start near 0
                    const values = dasharray.split(/[\s,]+/).map(parseFloat)
                    return values[0] < 0.1 // First value should be near 0 initially
                },
                {
                    message: 'strokeDasharray should start near 0 for line-drawing effect',
                    timeout: 2000
                }
            )
            .toBe(true)

        // After animation progresses, strokeDasharray should increase
        await page.waitForTimeout(1000) // Wait halfway through the 2s animation

        await expect
            .poll(
                async () => {
                    const dasharray = await getStrokeDasharray()
                    if (dasharray === 'none') return false
                    const values = dasharray.split(/[\s,]+/).map(parseFloat)
                    // First value should be significantly larger than 0
                    return values[0] > 0.3
                },
                {
                    message:
                        'strokeDasharray first value should increase during animation (line drawing)',
                    timeout: 2000
                }
            )
            .toBe(true)

        // At the end, strokeDasharray should be approximately "1 1" (fully drawn)
        await page.waitForTimeout(1500) // Wait for animation to complete

        await expect
            .poll(
                async () => {
                    const dasharray = await getStrokeDasharray()
                    if (dasharray === 'none') return false
                    const values = dasharray.split(/[\s,]+/).map(parseFloat)
                    // First value should be close to 1 (fully drawn)
                    return values[0] > 0.9
                },
                {
                    message: 'strokeDasharray should end near "1" for fully drawn path',
                    timeout: 2000
                }
            )
            .toBe(true)
    })

    test.skip('should support pathOffset animation', async () => {
        // pathOffset is another SVG-specific animation property
        // that should animate strokeDashoffset
        // This test is skipped until pathOffset is implemented
    })
})
