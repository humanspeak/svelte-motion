import { expect, test, type Locator } from '@playwright/test'

/**
 * Regression test for #349 — variant string keys on `whileX` props.
 *
 * Asserts that a `whileHover="variantKey"` form scales identically to
 * an inline `whileHover={{ scale: 1.25 }}` form, and that the array
 * form (`whileHover={["hovered", "tinted"]}`) merges variants
 * left-to-right with later entries winning on key collisions
 * (`backgroundColor` from `tinted` overrides `hovered`'s absence of
 * one).
 */
test.describe('motion/while-string-variants', () => {
    /** Read uniform scale from the computed transform matrix. */
    const readScale = async (el: Locator) => {
        const t = await el.evaluate((node) => getComputedStyle(node as HTMLElement).transform)
        if (!t || t === 'none') return 1
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return 1
        const parts = m[1].split(',').map((v) => Number.parseFloat(v.trim()))
        const a = parts[0] ?? 1
        const b = parts[1] ?? 0
        const c = parts[2] ?? 0
        const d = parts[3] ?? 1
        return (Math.hypot(a, b) + Math.hypot(c, d)) / 2
    }

    test('whileHover with a single variant key scales the element', async ({ page }) => {
        await page.goto('/tests/motion/while-string-variants?@isPlaywright=true')

        const box = page.getByTestId('box-while-hover-string')
        await expect(box).toBeVisible()
        // Let hydration finish before the first pointer event: a hover fired
        // before listeners attach is silently lost (house convention — see
        // hover-and-tap.test.ts).
        await page.waitForTimeout(800)

        // Identity transform at rest.
        const initialScale = await readScale(box)
        expect(Math.abs(initialScale - 1)).toBeLessThan(0.05)

        await box.hover()
        // Hover variant has scale: 1.25 — should clearly exceed 1.1.
        await expect.poll(() => readScale(box)).toBeGreaterThan(1.1)
    })

    test('whileHover with an array merges variants left-to-right (later wins on color)', async ({
        page
    }) => {
        await page.goto('/tests/motion/while-string-variants?@isPlaywright=true')

        const box = page.getByTestId('box-while-hover-array')
        await expect(box).toBeVisible()
        // Hydration settle — see above.
        await page.waitForTimeout(800)

        // Initial background is the inline orange (`#f97316`). After
        // hover, the array `["hovered", "tinted"]` should resolve so
        // `tinted`'s `backgroundColor` ('#22c55e' — green) wins.
        const initialBg = await box.evaluate(
            (el) => getComputedStyle(el as HTMLElement).backgroundColor
        )
        expect(initialBg).not.toBe('rgb(34, 197, 94)') // not green yet

        await box.hover()

        await expect
            .poll(async () =>
                box.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor)
            )
            .toBe('rgb(34, 197, 94)') // green from `tinted`

        // And the `hovered` variant's scale still applies — array merge
        // preserves keys from earlier entries when later entries don't
        // override them.
        await expect.poll(() => readScale(box)).toBeGreaterThan(1.1)
    })
})
