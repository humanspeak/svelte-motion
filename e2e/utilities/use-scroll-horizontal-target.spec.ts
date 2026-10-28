import { expect, test, type Page } from '@playwright/test'

/**
 * #2546 (Motion 14.7.1, `8dce64350`): useScroll({ container, target }) in a
 * horizontally scrolling container reported the container's scroll progress
 * on scrollXProgress rather than the target's. Port of Motion's
 * `tests/react/issue-2546.spec.ts` @ v14.7.1.
 *
 * Item 5 spans 1000-1200px of a 2000px-wide row in a 400px container, with an
 * offset equivalent to ["start end", "end start"], so its progress runs over
 * scrollLeft 600 -> 1200. At scrollLeft 700 the target progress is 1/6, while
 * the container's own progress is 700 / 1600 = 0.4375.
 */
const URL = '/tests/use-scroll/horizontal-target?@isPlaywright=true'
const REPORTER_URL = '/tests/use-scroll/horizontal-target/reporter?@isPlaywright=true'

async function scrollTo(page: Page, left: number) {
    await page.evaluate((x) => {
        document.getElementById('container')!.scrollLeft = x
    }, left)
    await page.waitForTimeout(200)
}

test('stays on the JS scroll() path', async ({ page }) => {
    // The fixture's px offset must not map to a native ViewTimeline, or the
    // rest of this file silently tests the native path instead of #2546.
    await page.goto(URL)
    await expect(page.getByTestId('accelerated')).toHaveText('false')
})

for (const axis of ['', 'x']) {
    test.describe(`Issue #2546 (axis: ${axis || 'default'})`, () => {
        test('scrollXProgress tracks the target, not the container', async ({ page }) => {
            await page.goto(`${URL}${axis ? `&axis=${axis}` : ''}`)
            await expect(page.locator('#container')).toBeVisible()
            await page.waitForTimeout(100)

            await scrollTo(page, 700)
            const progress = await page.evaluate(
                () => (window as unknown as { __progress?: number }).__progress
            )
            expect(progress).toBeCloseTo(1 / 6, 2)

            const scaleX = await page.evaluate(() => {
                const { transform } = getComputedStyle(document.getElementById('bar')!)
                return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a
            })
            expect(scaleX).toBeCloseTo(1 / 6, 1)
        })
    })
}

test('reporter stays on the JS scroll() path', async ({ page }) => {
    // The reporter's vw offset must not map to a native ViewTimeline either.
    // Flags start undefined, so all twelve reading exactly false proves every
    // ring's onAccelerated callback fired.
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(REPORTER_URL)
    await expect(page.getByTestId('accelerated-flags')).toHaveText(
        JSON.stringify(Array.from({ length: 12 }, () => false))
    )
    await expect(page.getByTestId('accelerated')).toHaveText('false')
})

/**
 * The reporter's page: twelve 70vw items in a fixed, full-width horizontal
 * scroller, each with an offset equivalent to ["end end", "start start"]. At a
 * 1280px viewport item 2 spans 1792-2688px, so its progress runs over
 * scrollLeft 1408 -> 1792, and is 0.5 at 1600. The container's own progress
 * there is 1600 / 9472 ≈ 0.17.
 */
test('Issue #2546 reporter: each indicator tracks its own item', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(REPORTER_URL)
    await expect(page.locator('#container')).toBeVisible()
    await page.waitForTimeout(100)

    await scrollTo(page, 1600)
    const dash = (i: number) =>
        page.evaluate(
            (id) =>
                parseFloat(document.getElementById(id)!.getAttribute('stroke-dasharray') || '0'),
            `indicator-${i}`
        )

    expect(await dash(1)).toBeCloseTo(1, 2)
    expect(await dash(2)).toBeCloseTo(0.5, 2)
    expect(await dash(3)).toBeCloseTo(0, 2)
})
