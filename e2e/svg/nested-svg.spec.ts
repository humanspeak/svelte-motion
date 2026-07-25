import { expect, test } from '@playwright/test'

const ROUTE = '/tests/svg/nested-svg'

/**
 * Root-`<svg>` parity pins (operator ruling 2026-07-25; Codex adversarial
 * review follow-up). Upstream's `buildSVGAttrs` treats an actual `<svg>` tag
 * as HTML-like: transforms stay live on `style`, while the
 * `attrX`/`attrY`/`attrScale` → attribute copy sits BELOW its early return
 * and never runs. React framer-motion behaves identically, so both facts are
 * pinned deliberately. Issue #456 tracks lifting the attrX limitation
 * post-1.x — when it lands, the frozen-attrX pin below flips to expect a
 * live attribute.
 */
test.describe('nested motion.svg root-tag parity', () => {
    test('a bound x animates the root svg via CSS transform', async ({ page }) => {
        await page.goto(ROUTE)

        const svg = page.getByTestId('transform-svg')
        await expect(svg).toBeAttached()

        const readTransform = () => svg.evaluate((el) => getComputedStyle(el).transform)

        await page.getByTestId('bump-x').click()

        // The x channel renders as a transform matrix, not the x attribute.
        await expect
            .poll(async () => {
                const t = await readTransform()
                const match = /matrix\(1, 0, 0, 1, ([-\d.]+),/.exec(t)
                return match ? parseFloat(match[1]) : 0
            })
            .toBeGreaterThan(20)

        // The x ATTRIBUTE is not the animation channel for the root svg tag.
        expect(await svg.getAttribute('x')).toBeNull()
    })

    test('a bound attrX on the root svg tag is a documented no-op (#456)', async ({ page }) => {
        await page.goto(ROUTE)

        const frozen = page.getByTestId('frozen-svg')
        const live = page.getByTestId('transform-svg')
        await expect(frozen).toBeAttached()

        const seed = await frozen.getAttribute('x')
        expect(seed).toBe('20')

        // Bump BOTH values; wait for the live one to move so the frozen
        // assertion runs after a subscription flush, not before one.
        await page.getByTestId('bump-attr-x').click()
        await page.getByTestId('bump-x').click()
        await expect
            .poll(async () => live.evaluate((el) => getComputedStyle(el).transform))
            .not.toBe('none')

        // Upstream parity: the renderer's root-svg early return drops attrX,
        // so the attribute keeps its server-rendered seed. If this assertion
        // starts failing after a motion-dom upgrade or #456 lands, the
        // limitation was lifted — update this pin to expect a live attribute.
        expect(await frozen.getAttribute('x')).toBe(seed)
        expect(await frozen.evaluate((el) => getComputedStyle(el).transform)).toBe('none')
    })
})
