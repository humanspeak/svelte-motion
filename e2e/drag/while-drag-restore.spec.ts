import { expect, test } from '@playwright/test'

/**
 * Regression for the whileDrag baseline-restore race. When the user
 * re-grabs mid-restore on a card with `whileDrag={{ scale: 1.05 }}`,
 * the final scale after the second release should still settle exactly
 * to 1.0 — not to whatever transient value the restore had reached
 * when the new drag started.
 *
 * Note: as written today, `computeHoverBaseline` derives the restore
 * target from prop values (initial/animate/whileHover), not from the
 * element's current rendered styles, so the audit's speculative
 * "captures transient value" concern does not apply. This test exists
 * to lock that contract in.
 */

const readScale = async (page: import('@playwright/test').Page) => {
    return page.evaluate(() => {
        const el = document.querySelector('[data-testid="drag-card"]') as HTMLElement | null
        if (!el) return null
        const t = window.getComputedStyle(el).transform
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return 1
        const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
        // matrix(a, b, c, d, tx, ty) — uniform scale → a == d
        return parts[0] ?? 1
    })
}

test.describe('drag/whileDrag restore', () => {
    test('re-grab mid-restore still settles scale to 1.0', async ({ page }) => {
        await page.goto('/tests/drag/while-drag-restore?@isPlaywright=true')
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        const s = await card.boundingBox()
        if (!s) throw new Error('no bbox')
        const cx = s.x + s.width / 2
        const cy = s.y + s.height / 2

        // First drag → scale should animate to 1.05.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 60, cy, { steps: 4 })
        await page.waitForTimeout(80)
        await page.mouse.up()

        // Mid-restore (~150 ms into a 0.4s transition) the scale is
        // partway between 1.05 and 1.0.
        await page.waitForTimeout(150)
        const midScale = await readScale(page)
        if (midScale === null) throw new Error('no transform')
        expect(midScale).toBeGreaterThan(1.001)
        expect(midScale).toBeLessThan(1.05)

        // Re-grab from current position, drag a little, release.
        const midRect = await card.boundingBox()
        if (!midRect) throw new Error('no mid bbox')
        const midCx = midRect.x + midRect.width / 2
        await page.mouse.move(midCx, cy)
        await page.mouse.down()
        await page.mouse.move(midCx + 30, cy, { steps: 3 })
        await page.waitForTimeout(80)
        await page.mouse.up()

        // Allow the second restore to fully complete.
        await page.waitForTimeout(600)
        const finalScale = await readScale(page)
        if (finalScale === null) throw new Error('no transform')
        // Final scale must be exactly 1.0 — not stuck at the transient
        // mid-restore baseline.
        expect(Math.abs(finalScale - 1)).toBeLessThan(0.005)
    })
})
