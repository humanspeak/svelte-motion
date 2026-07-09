import { expect, type Locator, type Page, test } from '@playwright/test'

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

/**
 * Attribute values can carry units once the client takes over. `addAttrValue`
 * writes through `getValueAsType(v, numberValueTypes[key])`, and
 * `numberValueTypes.x` is a px type — so after hydration `attrX` reads
 * `x="25px"` (a valid SVG length). Keys with no entry, like `x2`, `scale` and
 * `stdDeviation`, stay unitless.
 *
 * The SSR seed is different: `computeSSRSVGAttrValues` stringifies the raw
 * MotionValue and never appends a unit, so the server payload carries `x="10"`.
 * Hence `parseFloat` rather than `Number` — it reads both.
 */
const attrNumber = async (locator: Locator, name: string): Promise<number> =>
    parseFloat((await locator.getAttribute(name)) ?? '')

/**
 * Matches a stringified MotionValue in *attribute position*. The demo page names
 * the failure mode in its own prose, so a bare substring check on the document
 * would trip over the copy rather than a real defect.
 */
const STRINGIFIED_MOTION_VALUE = /="\[object Object\]"/

test.describe('SVG MotionValue attributes', () => {
    test('never stringifies a MotionValue into the DOM', async ({ page }) => {
        await page.goto(ROUTE)
        await expect(page.getByTestId('mv-circle')).toBeVisible()

        const html = await page.content()
        expect(html).not.toMatch(STRINGIFIED_MOTION_VALUE)
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

        const before = await attrNumber(rect, 'x')
        expect(Number.isFinite(before)).toBe(true)

        await page.getByTestId('bump-attr-x').click()

        await expect
            .poll(async () => attrNumber(rect, 'x'), { timeout: 5000 })
            .toBeGreaterThan(before)
    })

    /**
     * Forces the element to be created by `createElementNS` rather than by the HTML
     * parser.
     *
     * The parser silently case-corrects `<fedisplacementmap>` when it reads SSR
     * markup, and Svelte's hydration reuses that node instead of calling
     * `create_element` (`svelte-element.js:74`). A `page.goto` + `tagName` check
     * therefore passes even with the tag-casing fix reverted — verified by reverting
     * it. Only the remount path runs `createElementNS` with the tag verbatim.
     */
    const remount = async (page: Page): Promise<void> => {
        await page.getByTestId('toggle-mounted').uncheck()
        await expect(page.getByTestId('displacement-map')).toHaveCount(0)
        await page.getByTestId('toggle-mounted').check()
        await expect(page.getByTestId('displacement-map')).toBeAttached()
    }

    test('renders camelCase SVG tags with their case-sensitive spec spelling', async ({ page }) => {
        await page.goto(ROUTE)
        await remount(page)

        // SVG tag names are case-sensitive. A lowercase `fedisplacementmap` built by
        // createElementNS is an inert generic SVGElement: the filter primitive is
        // silently ignored and its `scale` does nothing.
        const info = await page.getByTestId('displacement-map').evaluate((el) => ({
            tagName: el.tagName,
            ctor: el.constructor.name,
            // The IDL attribute only exists on the real interface.
            hasScaleIDL: 'scale' in el
        }))

        expect(info.tagName).toBe('feDisplacementMap')
        expect(info.ctor).toBe('SVGFEDisplacementMapElement')
        expect(info.hasScaleIDL).toBe(true)
    })

    test('renders attrScale as the scale attribute on feDisplacementMap', async ({ page }) => {
        await page.goto(ROUTE)
        await remount(page)

        const map = page.getByTestId('displacement-map')
        const scale = await map.getAttribute('scale')
        expect(scale).not.toBeNull()
        expect(Number.isFinite(Number(scale))).toBe(true)

        // No px unit: `scale` has a unitless entry in numberValueTypes.
        expect(scale).not.toContain('px')
    })

    test('updates the feDisplacementMap scale attribute when attrScale changes', async ({
        page
    }) => {
        await page.goto(ROUTE)
        await remount(page)

        const map = page.getByTestId('displacement-map')
        await expect.poll(async () => attrNumber(map, 'scale'), { timeout: 5000 }).toBe(12)

        await page.getByTestId('slider-attr-scale').fill('30')
        await expect.poll(async () => attrNumber(map, 'scale'), { timeout: 5000 }).toBe(30)

        // The live SVG DOM parses it, not just the attribute string. On an inert
        // SVGElement `scale` is undefined, which is the point of the tag-casing fix.
        const baseVal = await map.evaluate(
            (el) => (el as SVGFEDisplacementMapElement).scale.baseVal
        )
        expect(baseVal).toBe(30)
    })

    test('writes attrScale to the rect but leaves the rect visually unchanged', async ({
        page
    }) => {
        await page.goto(ROUTE)

        const rect = page.getByTestId('attr-rect')
        await expect(rect).toBeVisible()

        const geometry = () =>
            rect.evaluate((el) => {
                const box = (el as SVGGraphicsElement).getBBox()
                return {
                    width: box.width,
                    height: box.height,
                    transform: getComputedStyle(el).transform,
                    cssScale: getComputedStyle(el).scale
                }
            })

        const before = await geometry()
        expect(before.width).toBe(40)
        expect(before.height).toBe(40)

        await page.getByTestId('slider-attr-scale').fill('30')

        // The attribute tracks the MotionValue...
        await expect.poll(async () => attrNumber(rect, 'scale'), { timeout: 5000 }).toBe(30)

        // ...but `scale` is not a presentation attribute on shape elements, so the
        // rect ignores it. This is upstream's behavior: attrScale reaches the
        // attribute channel and never becomes a CSS transform.
        const after = await geometry()
        expect(after.width).toBe(before.width)
        expect(after.height).toBe(before.height)
        expect(after.transform === 'none' || after.transform === '').toBe(true)
        expect(after.cssScale === 'none' || after.cssScale === '').toBe(true)
    })

    test('updates x2 on the attribute channel for a non-attr-prefixed key', async ({ page }) => {
        await page.goto(ROUTE)

        const line = page.getByTestId('chart-line')
        // A horizontal line has a zero-height bounding box, so Playwright reports it
        // as hidden. Attachment is the meaningful check here.
        await expect(line).toBeAttached()

        // x1/y1/x2/y2 are not in element.style, so svgEffect writes them via
        // setAttribute even though they carry no `attr` prefix.
        const before = await attrNumber(line, 'x2')
        expect(Number.isFinite(before)).toBe(true)

        await page.getByTestId('bump-cx').click()

        await expect
            .poll(async () => attrNumber(line, 'x2'), { timeout: 5000 })
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

    test('does not re-render the attribute spread when a bound value changes', async ({ page }) => {
        await page.goto(ROUTE)

        const circle = page.getByTestId('mv-circle')
        await expect(circle).toBeVisible()

        // `cx` is style-routed, so its attribute is a one-time SSR seed. If the
        // spread tracked the MotionValue (this library's values are Svelte-augmented,
        // so a tracked `.get()` would), the attribute would follow the style and the
        // whole attrs object would recompute every frame of an animation.
        const seed = await circle.getAttribute('cx')

        await page.getByTestId('bump-cx').click()
        await expect.poll(async () => computedNumber(circle, 'cx'), { timeout: 5000 }).toBe(60)

        expect(await circle.getAttribute('cx')).toBe(seed)
    })

    test('an unrelated re-render does not clobber attribute-routed values', async ({ page }) => {
        await page.goto(ROUTE)

        const rect = page.getByTestId('attr-rect')
        await expect(rect).toBeVisible()

        await page.getByTestId('bump-attr-x').click()
        await expect.poll(async () => attrNumber(rect, 'x'), { timeout: 5000 }).toBe(25)

        // Force a Svelte re-render of the attribute spread via an unrelated class change.
        await page.getByTestId('toggle-highlight').check()

        // The toggle must re-render the subtree containing the element under test.
        // Highlighting an unrelated <svg> leaves this test passing even if the bug
        // returns, because `attr-rect`'s spread is never re-evaluated.
        await expect
            .poll(async () => rect.evaluate((el) => !!el.closest('[data-highlight="true"]')), {
                timeout: 2000
            })
            .toBe(true)

        // svgEffect owns `x`; the spread must not reset it to the initial seed.
        await expect.poll(async () => attrNumber(rect, 'x'), { timeout: 2000 }).toBe(25)
    })

    test('binds a MotionValue to a filter primitive attribute', async ({ page }) => {
        await page.goto(ROUTE)

        const blur = page.getByTestId('blur-filter')
        await expect(blur).toBeAttached()

        // Plan 005 drives feTurbulence/feOffset/feGaussianBlur from MotionValues.
        // An unclaimed key falls through to the raw spread and stringifies.
        expect(await blur.getAttribute('stdDeviation')).not.toBe('[object Object]')

        const before = await attrNumber(blur, 'stdDeviation')
        expect(Number.isFinite(before)).toBe(true)

        await page.getByTestId('slider-blur').fill('6')
        await expect.poll(async () => attrNumber(blur, 'stdDeviation'), { timeout: 5000 }).toBe(6)

        // The live SVG DOM parses it, not just the attribute string.
        const baseVal = await blur.evaluate(
            (el) => (el as SVGFEGaussianBlurElement).stdDeviationX.baseVal
        )
        expect(baseVal).toBe(6)
    })

    test('server-renders a filter primitive attribute without stringifying it', async ({
        request
    }) => {
        const response = await request.get(ROUTE)
        expect(response.ok()).toBe(true)

        const html = await response.text()
        const blur = html.match(/<feGaussianBlur[^>]*data-testid="blur-filter"[^>]*>/i)?.[0]

        expect(blur, 'blur-filter should be present in the SSR payload').toBeTruthy()
        expect(blur).not.toMatch(STRINGIFIED_MOTION_VALUE)

        // Svelte's SSR spread lowercases attribute names, so the payload carries
        // `stddeviation="2"`. That is harmless: the HTML parser case-corrects SVG
        // attribute names on the way in — the same adjustment table that fixes tag
        // names — so the hydrated element exposes `stdDeviation` and a live
        // `stdDeviationX.baseVal`. The client-DOM test above asserts that. What
        // matters here is that a number, not a MotionValue, reaches the payload.
        expect(blur).toMatch(/stddeviation="[\d.]+"/i)
        // And never the dash-cased form, which no parser would rescue.
        expect(blur).not.toMatch(/std-deviation=/i)
    })

    test('reattaches cleanly after unmount and remount', async ({ page }) => {
        await page.goto(ROUTE)
        await expect(page.getByTestId('mv-circle')).toBeVisible()

        await page.getByTestId('toggle-mounted').uncheck()
        await expect(page.getByTestId('mv-circle')).toHaveCount(0)

        await page.getByTestId('toggle-mounted').check()
        const circle = page.getByTestId('mv-circle')
        await expect(circle).toBeVisible()

        expect(await page.content()).not.toMatch(STRINGIFIED_MOTION_VALUE)
        await expect.poll(async () => computedNumber(circle, 'cx'), { timeout: 5000 }).toBe(40)

        // Subscriptions survive the remount.
        await page.getByTestId('bump-cx').click()
        await expect.poll(async () => computedNumber(circle, 'cx'), { timeout: 5000 }).toBe(60)
    })

    test('server-rendered markup carries the resolved attribute values', async ({ request }) => {
        const response = await request.get(ROUTE)
        expect(response.ok()).toBe(true)

        const html = await response.text()
        expect(html).not.toMatch(STRINGIFIED_MOTION_VALUE)

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
