import { expect, type Locator, test } from '@playwright/test'

const ROUTE = '/tests/svg/motion-value-attributes'

/**
 * A MotionValue bound to an SVG presentation attribute must be subscribed to,
 * not spread raw onto the element (which stringifies as `[object Object]`).
 *
 * Upstream parity: motion-dom `svgEffect` (effects/svg/index.ts) routes each key
 * to one of two DOM channels:
 *
 * - `attr*`, `points`, `viewBox`, `x1/y1/x2/y2` -> `setAttribute`
 * - `cx cy r x y width height d stroke-*` -> `element.style`, because
 *   `key in element.style` is true for these in Chromium
 *
 * Tests must read the channel the key actually routes to. Polling
 * `getAttribute('cx')` never observes a change and hangs until timeout.
 */

/** Reads a resolved CSS property, e.g. `cx` -> `"40px"`. */
const computed = (locator: Locator, property: string): Promise<string> =>
    locator.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property)

/**
 * Computed styles carry units (`"12.5px"`). `Number("12.5px")` is `NaN`, and
 * `expect(NaN).not.toBe(NaN)` passes vacuously in the wrong direction because
 * `toBe` is `Object.is`. Always `parseFloat`.
 */
const computedNumber = async (locator: Locator, property: string): Promise<number> =>
    parseFloat(await computed(locator, property))

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

        // Style-routed keys still SSR as presentation attributes; the client-set
        // CSS property wins afterwards.
        const cx = await circle.getAttribute('cx')
        expect(cx).not.toBeNull()
        expect(Number.isFinite(Number(cx))).toBe(true)
    })

    test('updates cx on the style channel when the MotionValue changes', async ({ page }) => {
        await page.goto(ROUTE)

        const circle = page.getByTestId('mv-circle')
        await expect(circle).toBeVisible()

        const before = await computedNumber(circle, 'cx')
        expect(Number.isFinite(before)).toBe(true)

        await page.getByTestId('bump-cx').click()

        await expect
            .poll(async () => computedNumber(circle, 'cx'), { timeout: 5000 })
            .toBeGreaterThan(before)
    })

    test('drives a progress ring via stroke-dashoffset', async ({ page }) => {
        await page.goto(ROUTE)

        const ring = page.getByTestId('progress-ring')
        await expect(ring).toBeVisible()

        const before = await computedNumber(ring, 'stroke-dashoffset')
        expect(Number.isFinite(before)).toBe(true)

        await page.getByTestId('advance-progress').click()

        await expect
            .poll(async () => computedNumber(ring, 'stroke-dashoffset'), { timeout: 5000 })
            .toBeLessThan(before)
    })

    test('binds a kebab-case stroke-width prop, the spelling Svelte authors write', async ({
        page
    }) => {
        await page.goto(ROUTE)

        const circle = page.getByTestId('kebab-circle')
        await expect(circle).toBeVisible()

        // The regression this feature exists to kill.
        expect(await circle.getAttribute('stroke-width')).not.toBe('[object Object]')

        const before = await computedNumber(circle, 'stroke-width')
        expect(Number.isFinite(before)).toBe(true)

        await page.getByTestId('bump-stroke-width').click()

        await expect
            .poll(async () => computedNumber(circle, 'stroke-width'), { timeout: 5000 })
            .toBeGreaterThan(before)
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
        const transform = await computed(rect, 'transform')
        expect(transform === 'none' || transform === '').toBe(true)
    })

    test('updates the x attribute when the attrX MotionValue changes', async ({ page }) => {
        await page.goto(ROUTE)

        const rect = page.getByTestId('attr-rect')
        await expect(rect).toBeVisible()

        const before = Number(await rect.getAttribute('x'))
        expect(Number.isFinite(before)).toBe(true)

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
        expect(Number.isFinite(Number(scale))).toBe(true)
    })

    test('updates x2 on the attribute channel for a non-attr-prefixed key', async ({ page }) => {
        await page.goto(ROUTE)

        const line = page.getByTestId('chart-line')
        await expect(line).toBeVisible()

        // x1/y1/x2/y2 are not in element.style, so svgEffect writes them via
        // setAttribute even though they carry no `attr` prefix.
        const before = Number(await line.getAttribute('x2'))
        expect(Number.isFinite(before)).toBe(true)

        await page.getByTestId('bump-cx').click()

        await expect
            .poll(async () => Number(await line.getAttribute('x2')), { timeout: 5000 })
            .toBeGreaterThan(before)
    })

    test('leaves a plain numeric cx static on the channel the live element reads', async ({
        page
    }) => {
        await page.goto(ROUTE)

        const staticCircle = page.getByTestId('static-circle')
        const boundCircle = page.getByTestId('mv-circle')
        await expect(staticCircle).toBeVisible()
        expect(await staticCircle.getAttribute('cx')).toBe('5')

        // Read the style channel, the one a bound cx would move. Asserting the
        // attribute is unchanged would pass even if the subscription were broken.
        const before = await computedNumber(staticCircle, 'cx')
        expect(before).toBe(5)

        const boundBefore = await computedNumber(boundCircle, 'cx')
        await page.getByTestId('bump-cx').click()

        // Wait for the bound circle to actually move, so the static assertion
        // below is made after a subscription flush rather than before one.
        await expect
            .poll(async () => computedNumber(boundCircle, 'cx'), { timeout: 5000 })
            .toBeGreaterThan(boundBefore)

        expect(await computedNumber(staticCircle, 'cx')).toBe(5)
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

        // Case-sensitive: a `strokeDashoffset` attribute would be inert.
        const ring = html.match(/<circle[^>]*data-testid="progress-ring"[^>]*>/)?.[0]
        expect(ring).toBeTruthy()
        expect(ring).toMatch(/stroke-dashoffset="[\d.-]+"/)
        expect(ring).not.toMatch(/strokeDashoffset=/)

        // Gate ordering: `attrX` must resolve to `x` before dash-casing, never
        // to the inert `attr-x`.
        const rect = html.match(/<rect[^>]*data-testid="attr-rect"[^>]*>/)?.[0]
        expect(rect).toBeTruthy()
        expect(rect).toMatch(/\sx="[\d.]+"/)
        expect(rect).not.toMatch(/attr-x=/)
        expect(rect).not.toMatch(/attrX=/)
    })
})
