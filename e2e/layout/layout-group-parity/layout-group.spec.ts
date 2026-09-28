import { expect, test, type Page } from '@playwright/test'

/**
 * Port of upstream `packages/framer-motion/cypress/integration/layout-group.ts`
 * (Motion v13.4.5) against `/tests/layout/layout-group`.
 *
 * The button's top is recorded on every animation frame, so the "doesn't
 * jump" checks see every rendered position rather than a single sample
 * taken after a fixed wait, which slow CI can overshoot.
 *
 * Settle targets: upstream asserts 104 / 129 / 204. Those don't reproduce in
 * Chromium — upstream's own fixture rendered as static HTML measures
 * 39 / 114 / 149 / 224 (initial / after expander / after button / button then
 * expander), identical to our port; the difference is the column's 10px gap.
 * Per the plan's 2026-09-28 revision we assert the measured Chromium tops and
 * keep upstream's "intermediate frames exist" checks exactly as written.
 */
const INITIAL_TOP = 39
const EXPANDED_TOP = 114
const VISIBLE_TOP = 149
const VISIBLE_EXPANDED_TOP = 224

async function visit(page: Page) {
    await page.setViewportSize({ width: 500, height: 500 })
    await page.goto('/tests/layout/layout-group?@isPlaywright=true')
    await page.locator('#button').waitFor({ state: 'visible' })
    await page.waitForTimeout(250)
}

/** Start recording `#button`'s rounded top every rAF into `window.__tops`. */
async function recordButtonTops(page: Page) {
    await page.evaluate(() => {
        const w = window as unknown as { __tops: number[] }
        const button = document.getElementById('button')!
        w.__tops = []
        const record = () => {
            w.__tops.push(Math.round(button.getBoundingClientRect().top))
            requestAnimationFrame(record)
        }
        record()
    })
}

const readTops = (page: Page) =>
    page.evaluate(() => [...(window as unknown as { __tops: number[] }).__tops])

/**
 * Unrounded, so this waits for the layout animation to finish rather than
 * its eased tail.
 */
async function expectButtonToSettleAt(page: Page, top: number) {
    await expect
        .poll(() =>
            page.evaluate(() => document.getElementById('button')!.getBoundingClientRect().top)
        )
        .toBe(top)
}

function framesBetween(tops: number[], from: number, to: number) {
    return tops.filter((top) => top !== from && top !== to)
}

function expectFramesBetween(tops: number[], from: number, to: number) {
    expect(
        framesBetween(tops, from, to),
        `frames other than ${from} and ${to}: ${tops.join(',')}`
    ).not.toHaveLength(0)
}

test.describe('LayoutGroup inherit="id"', () => {
    // Red on 2026-09-28: #button snaps 39 -> 114 in one frame (no intermediate frames). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail('relative children should not instantly jump to new layout', async ({ page }) => {
        await visit(page)

        await recordButtonTops(page)
        await page.locator('#expander').click()
        await expectButtonToSettleAt(page, EXPANDED_TOP)

        // Should have rendered positions between the original and final
        const tops = await readTops(page)
        expectFramesBetween(tops, tops[0], EXPANDED_TOP)
    })

    // Red on 2026-09-28: #button snaps 149 -> 224 in one frame (no intermediate frames). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail(
        'relative children should not instantly jump to new layout, after performing their own layout animation',
        async ({ page }) => {
            await visit(page)

            // Click button first and let it finish its own layout animation
            await page.locator('#button').click()
            await expectButtonToSettleAt(page, VISIBLE_TOP)

            await recordButtonTops(page)
            await page.locator('#expander').click()
            await expectButtonToSettleAt(page, VISIBLE_EXPANDED_TOP)

            expectFramesBetween(await readTops(page), VISIBLE_TOP, VISIBLE_EXPANDED_TOP)
        }
    )

    // Red on 2026-09-28: #button snaps on the first #expander click, so it never reaches mid-animation (no intermediate frames). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail(
        'should return to original state when expander is clicked twice with delay',
        async ({ page }) => {
            await visit(page)

            await recordButtonTops(page)
            const initial = (await readTops(page))[0]
            expect(initial).toBe(INITIAL_TOP)
            await page.locator('#expander').click()

            // Click the expander again once the button is mid-animation
            await expect
                .poll(async () => framesBetween(await readTops(page), initial, EXPANDED_TOP).length)
                .toBeGreaterThan(0)
            await page.waitForTimeout(50)
            await page.locator('#expander').click()

            // Should be back to original state
            await expectButtonToSettleAt(page, initial)
        }
    )
})
