import { expect, test } from '@playwright/test'

test.describe('SVG pathLength Animation', () => {
    test('animates pathLength 0→1 with normalized dash attributes and no flash', async ({
        page
    }) => {
        await page.goto('/tests/motion/svg-path-length')

        const path = page.getByTestId('animated-path')
        await expect(path).toBeVisible()

        // Immediately verify attributes before animation progresses
        const initialAttrDash = await path.getAttribute('stroke-dasharray')
        expect(initialAttrDash, 'initial stroke-dasharray attribute should be emitted').toBeTruthy()
        if (initialAttrDash) {
            const initVals = initialAttrDash.split(/[\s,]+/).map((v) => parseFloat(v))
            expect(initVals[0] < 0.05, 'initial first dash value should be ~0').toBe(true)
        }

        // Small delay to allow animation to start
        await page.waitForTimeout(60)

        /**
         * pathLength animation should be implemented by Motion library using:
         * - Setting pathLength="1" attribute on the SVG path element
         * - Animating strokeDasharray from "0 1" to "1 1"
         * - This creates the line-drawing effect
         */

        const getStrokeDasharray = async (): Promise<string> =>
            await path.evaluate((el) => {
                // Prefer attribute for normalized values; fallback to computed
                return (
                    el.getAttribute('stroke-dasharray') ||
                    getComputedStyle(el).strokeDasharray ||
                    'none'
                )
            })

        const getStrokeDashoffset = async (): Promise<string> =>
            await path.evaluate(
                (el) =>
                    el.getAttribute('stroke-dashoffset') ||
                    getComputedStyle(el).strokeDashoffset ||
                    '0'
            )

        const getPathLengthAttr = async (): Promise<string | null> =>
            await path.evaluate((el) => el.getAttribute('pathLength'))

        // Initially, the path should have pathLength attribute set to "1" for normalization
        await expect
            .poll(async () => await getPathLengthAttr(), {
                message: 'pathLength attribute should be set to "1" for normalization',
                timeout: 1000
            })
            .toBe('1')

        // Attributes should be present from first paint to avoid flash
        await expect
            .poll(async () => (await getStrokeDasharray()) !== 'none', {
                message: 'stroke-dasharray attribute should be present on initial paint',
                timeout: 1000
            })
            .toBe(true)

        // Initially, stroke-dasharray should represent ~0% drawn (approximately "0px 1px")
        await expect
            .poll(
                async () => {
                    const dasharray = await getStrokeDasharray()
                    if (dasharray === 'none') return false
                    // Parse the dasharray value - should start near 0
                    const values = dasharray.split(/[\s,]+/).map((v) => parseFloat(v))
                    return values[0] < 0.1 // First value should be near 0 initially
                },
                {
                    message: 'strokeDasharray should start near 0 for line-drawing effect',
                    timeout: 2000
                }
            )
            .toBe(true)

        // Dashoffset should default to ~0px unless pathOffset is provided
        await expect
            .poll(async () => (await getStrokeDashoffset()).includes('0'), {
                message: 'stroke-dashoffset should default to 0px when pathOffset is not provided',
                timeout: 1000
            })
            .toBe(true)

        // After animation progresses, stroke-dasharray first value should increase
        await page.waitForTimeout(1000) // roughly halfway through the 2s animation

        await expect
            .poll(
                async () => {
                    const dasharray = await getStrokeDasharray()
                    if (dasharray === 'none') return false
                    const values = dasharray.split(/[\s,]+/).map((v) => parseFloat(v))
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

        // At the end, stroke-dasharray should be approximately "1px 0px" (fully drawn)
        await page.waitForTimeout(1500) // Wait for animation to complete

        await expect
            .poll(
                async () => {
                    const dasharray = await getStrokeDasharray()
                    if (dasharray === 'none') return false
                    const values = dasharray.split(/[\s,]+/).map((v) => parseFloat(v))
                    // First value should be close to 1 (fully drawn) in normalized units
                    return values[0] > 0.9
                },
                {
                    message: 'stroke-dasharray should end near "1px 0px" for fully drawn path',
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
