import { expect, test } from '@playwright/test'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

test.describe('SVG Namespace', () => {
    test('motion.svg elements should have correct SVG namespace', async ({ page }) => {
        await page.goto('/tests/svg/namespace')

        // Wait for SVG elements to be visible
        const svg = page.getByTestId('motion-svg')
        await expect(svg).toBeVisible()

        // Check that motion.svg has correct namespace
        const svgNamespace = await svg.evaluate((el) => el.namespaceURI)
        expect(svgNamespace).toBe(SVG_NAMESPACE)

        // Check element type
        const svgType = await svg.evaluate((el) => el.constructor.name)
        expect(svgType).toBe('SVGSVGElement')
    })

    test('motion.path should have correct SVG namespace', async ({ page }) => {
        await page.goto('/tests/svg/namespace')

        const path = page.getByTestId('motion-path')
        await expect(path).toBeVisible()

        const pathNamespace = await path.evaluate((el) => el.namespaceURI)
        expect(pathNamespace).toBe(SVG_NAMESPACE)

        const pathType = await path.evaluate((el) => el.constructor.name)
        expect(pathType).toBe('SVGPathElement')
    })

    test('motion.circle should have correct SVG namespace', async ({ page }) => {
        await page.goto('/tests/svg/namespace')

        const circle = page.getByTestId('motion-circle')
        await expect(circle).toBeVisible()

        const circleNamespace = await circle.evaluate((el) => el.namespaceURI)
        expect(circleNamespace).toBe(SVG_NAMESPACE)

        const circleType = await circle.evaluate((el) => el.constructor.name)
        expect(circleType).toBe('SVGCircleElement')
    })

    test('motion.line should have correct SVG namespace', async ({ page }) => {
        await page.goto('/tests/svg/namespace')

        const line = page.getByTestId('motion-line')
        await expect(line).toBeVisible()

        const lineNamespace = await line.evaluate((el) => el.namespaceURI)
        expect(lineNamespace).toBe(SVG_NAMESPACE)

        const lineType = await line.evaluate((el) => el.constructor.name)
        expect(lineType).toBe('SVGLineElement')
    })

    test('SVG elements should maintain correct namespace after AnimatePresence unmount/remount', async ({
        page
    }) => {
        await page.goto('/tests/svg/namespace')

        // Verify initial state
        const svg = page.getByTestId('motion-svg')
        await expect(svg).toBeVisible()

        const toggleButton = page.getByTestId('toggle-svg')

        // Unmount SVG
        await toggleButton.click()
        await expect(svg).not.toBeVisible()

        // Remount SVG
        await toggleButton.click()
        await expect(svg).toBeVisible()

        // Verify namespace is still correct after remount
        const svgNamespace = await svg.evaluate((el) => el.namespaceURI)
        expect(svgNamespace).toBe(SVG_NAMESPACE)

        const pathNamespace = await page
            .getByTestId('motion-path')
            .evaluate((el) => el.namespaceURI)
        expect(pathNamespace).toBe(SVG_NAMESPACE)

        const circleNamespace = await page
            .getByTestId('motion-circle')
            .evaluate((el) => el.namespaceURI)
        expect(circleNamespace).toBe(SVG_NAMESPACE)

        const lineNamespace = await page
            .getByTestId('motion-line')
            .evaluate((el) => el.namespaceURI)
        expect(lineNamespace).toBe(SVG_NAMESPACE)
    })

    test('SVG elements should NOT be HTMLUnknownElement', async ({ page }) => {
        await page.goto('/tests/svg/namespace')

        const svg = page.getByTestId('motion-svg')
        await expect(svg).toBeVisible()

        // None of the elements should be HTMLUnknownElement
        const svgType = await svg.evaluate((el) => el.constructor.name)
        expect(svgType).not.toBe('HTMLUnknownElement')

        const pathType = await page.getByTestId('motion-path').evaluate((el) => el.constructor.name)
        expect(pathType).not.toBe('HTMLUnknownElement')

        const circleType = await page
            .getByTestId('motion-circle')
            .evaluate((el) => el.constructor.name)
        expect(circleType).not.toBe('HTMLUnknownElement')

        const lineType = await page.getByTestId('motion-line').evaluate((el) => el.constructor.name)
        expect(lineType).not.toBe('HTMLUnknownElement')
    })
})
