import { expect, test } from '@playwright/test'

/**
 * Regression test for `<LayoutGroup>` scoping (#311).
 *
 * Scenario: two side-by-side tab strips wrapped in separate
 * `<LayoutGroup>`s, each containing an identical `layoutId="underline"`.
 * Without LayoutGroup scoping, the registry uses the raw id as the key,
 * so an underline unmounted on the left strip can be consumed by one
 * mounting on the right strip — the underline visibly "jumps" between
 * the two strips.
 *
 * With scoping, each strip's underline produces a different registry
 * key (`strip-a::underline` vs `strip-b::underline`), so the strips
 * animate independently.
 *
 * The decisive signal here is the on-mount FLIP delta. When clicking a
 * tab in strip B, the newly-mounted underline should consume the
 * snapshot from B's previous selection (a small same-strip delta), not
 * from A's last unmount (a page-width delta). We toggle A, then toggle
 * B, and assert B's new underline never moves more than the strip's own
 * width.
 */
test.describe('layout/group', () => {
    test('sibling LayoutGroups do not bridge a shared layoutId across the page', async ({
        page
    }) => {
        await page.goto('/tests/layout/group?@isPlaywright=true')

        const stripA = page.getByTestId('strip-a')
        const stripB = page.getByTestId('strip-b')
        await stripA.waitFor({ state: 'visible' })
        await stripB.waitFor({ state: 'visible' })

        // Bound the cross-strip distance: the horizontal gap between the
        // two strips is large; the within-a-single-strip tab distance is
        // small. Any animation that bridges the gap would translate by
        // hundreds of pixels.
        const aBox = await stripA.boundingBox()
        const bBox = await stripB.boundingBox()
        if (!aBox || !bBox) throw new Error('no bounding box for strips')
        const crossStripGap = Math.abs(bBox.x - aBox.x)
        // Pick a threshold comfortably below the gap so a cross-strip
        // FLIP would be flagged, but well above any reasonable
        // within-strip tab distance.
        const isolationThreshold = Math.min(aBox.width, crossStripGap * 0.5)

        // Select tab 2 on the left strip — this becomes the underline's
        // last unmount position on the bridged-key code path.
        await page.getByTestId('strip-a-tab-2').click()

        // Wait for A's underline to settle on tab 2.
        await expect
            .poll(async () => {
                const underline = await page.getByTestId('strip-a-underline').boundingBox()
                const tab = await page.getByTestId('strip-a-tab-2').boundingBox()
                if (!underline || !tab) return false
                return Math.abs(underline.x - tab.x) < 4
            })
            .toBe(true)

        // Now toggle the right strip. If the registry key isn't scoped,
        // B's underline mounts and consumes A's last snapshot — visible
        // translate from A's position toward B's tab 1.
        await page.getByTestId('strip-b-tab-1').click()

        // Sample the right strip's underline position across the
        // animation. The maximum observed |x - strip-b.left| stays
        // bounded inside strip B's box. If A bled into B, |x| would
        // briefly exceed the cross-strip gap.
        let maxOffsetFromB = 0
        for (let i = 0; i < 12; i++) {
            const underline = await page.getByTestId('strip-b-underline').boundingBox()
            if (underline) {
                const offset = Math.abs(underline.x - bBox.x)
                if (offset > maxOffsetFromB) maxOffsetFromB = offset
            }
            // Deliberate sample — ~2.5 frames at 60 fps per step, 12 steps spans
            // the 400 ms FLIP. expect.poll wouldn't help here: we need the max
            // observed offset across the animation, not eventual settle.
            await page.waitForTimeout(40)
        }

        expect(maxOffsetFromB).toBeLessThan(isolationThreshold)

        // And confirm B's underline ultimately lands on B's tab 1.
        await expect
            .poll(async () => {
                const underline = await page.getByTestId('strip-b-underline').boundingBox()
                const tab = await page.getByTestId('strip-b-tab-1').boundingBox()
                if (!underline || !tab) return false
                return Math.abs(underline.x - tab.x) < 4
            })
            .toBe(true)
    })

    test('regression page renders both strips and all six tabs', async ({ page }) => {
        await page.goto('/tests/layout/group?@isPlaywright=true')

        await expect(page.getByTestId('strip-a')).toBeVisible()
        await expect(page.getByTestId('strip-b')).toBeVisible()
        for (const id of [0, 1, 2]) {
            await expect(page.getByTestId(`strip-a-tab-${id}`)).toBeVisible()
            await expect(page.getByTestId(`strip-b-tab-${id}`)).toBeVisible()
        }
    })
})
