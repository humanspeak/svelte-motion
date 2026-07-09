import { expect, test } from '@playwright/test'

const ROUTE = '/tests/svg/motion-value-attributes'

/**
 * A MotionValue bound to an SVG presentation attribute must be subscribed to,
 * not spread raw onto the element (which stringifies as `[object Object]`).
 *
 * Upstream parity: motion-dom `svgEffect` routes non-path/non-attr keys through
 * `key in element.style ? addStyleValue : addAttrValue`, and renders
 * `attrX`/`attrY`/`attrScale` as the `x`/`y`/`scale` attributes.
 */
test.describe('SVG MotionValue attributes', () => {
    test('never stringifies a MotionValue into the DOM', async ({ page }) => {
        await page.goto(ROUTE)
        await expect(page.getByTestId('mv-circle')).toBeVisible()

        const html = await page.content()
        expect(html).not.toContain('[object Object]')
    })

    test('renders a numeric cx on first paint', async ({ page }) => {
        await page.goto(ROUTE)

        const circle = page.getByTestId('mv-circle')
        await expect(circle).toBeVisible()

        const cx = await circle.getAttribute('cx')
        expect(cx).not.toBeNull()
        expect(Number.isNaN(Number(cx))).toBe(false)
    })

    test('updates the cx attribute when the MotionValue changes', async ({ page }) => {
        await page.goto(ROUTE)

        const circle = page.getByTestId('mv-circle')
        await expect(circle).toBeVisible()

        const before = Number(await circle.getAttribute('cx'))
        await page.getByTestId('bump-cx').click()

        await expect
            .poll(async () => Number(await circle.getAttribute('cx')), { timeout: 5000 })
            .toBeGreaterThan(before)
    })

    test('drives a progress ring via r and stroke-dashoffset', async ({ page }) => {
        await page.goto(ROUTE)

        const ring = page.getByTestId('progress-ring')
        await expect(ring).toBeVisible()

        const readOffset = async () =>
            Number(
                (await ring.getAttribute('stroke-dashoffset')) ??
                    (await ring.evaluate((el) => getComputedStyle(el).strokeDashoffset))
            )

        const before = await readOffset()
        await page.getByTestId('advance-progress').click()

        await expect.poll(readOffset, { timeout: 5000 }).not.toBe(before)
    })

    test('renders attrX/attrY as the x/y attributes, not CSS transforms', async ({ page }) => {
        await page.goto(ROUTE)

        const rect = page.getByTestId('attr-rect')
        await expect(rect).toBeVisible()

        expect(await rect.getAttribute('x')).not.toBeNull()
        expect(await rect.getAttribute('y')).not.toBeNull()
        expect(await rect.getAttribute('attrX')).toBeNull()
        expect(await rect.getAttribute('attrY')).toBeNull()

        // attrX is an attribute channel, distinct from the CSS transform.
        const transform = await rect.evaluate((el) => getComputedStyle(el).transform)
        expect(transform === 'none' || transform === '').toBe(true)
    })

    test('updates the x attribute when the attrX MotionValue changes', async ({ page }) => {
        await page.goto(ROUTE)

        const rect = page.getByTestId('attr-rect')
        await expect(rect).toBeVisible()

        const before = Number(await rect.getAttribute('x'))
        await page.getByTestId('bump-attr-x').click()

        await expect
            .poll(async () => Number(await rect.getAttribute('x')), { timeout: 5000 })
            .toBeGreaterThan(before)
    })

    test('renders attrScale as the scale attribute', async ({ page }) => {
        await page.goto(ROUTE)

        const rect = page.getByTestId('attr-rect')
        await expect(rect).toBeVisible()

        const scale = await rect.getAttribute('scale')
        expect(scale).not.toBeNull()
        expect(Number.isNaN(Number(scale))).toBe(false)
    })

    test('leaves plain numeric attributes static, with no subscription', async ({ page }) => {
        await page.goto(ROUTE)

        const staticCircle = page.getByTestId('static-circle')
        await expect(staticCircle).toBeVisible()
        expect(await staticCircle.getAttribute('cx')).toBe('5')

        await page.getByTestId('bump-cx').click()
        await expect(staticCircle).toHaveAttribute('cx', '5')
    })

    test('server-rendered markup carries the resolved attribute values', async ({ request }) => {
        const response = await request.get(ROUTE)
        expect(response.ok()).toBe(true)

        const html = await response.text()
        expect(html).not.toContain('[object Object]')

        // The SSR payload must already carry a numeric cx so hydration doesn't flash.
        const circle = html.match(/<circle[^>]*data-testid="mv-circle"[^>]*>/)?.[0]
        expect(circle, 'mv-circle should be present in the SSR payload').toBeTruthy()
        expect(circle).toMatch(/cx="\d+(\.\d+)?"/)
    })
})
