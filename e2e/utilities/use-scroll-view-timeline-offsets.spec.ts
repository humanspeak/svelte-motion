import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/use-scroll/view-timeline-offsets?@isPlaywright=true'

/** Name of the native timeline driving an element's animation, or 'none'. */
const timelineOf = (page: Page, testId: string) => () =>
    page.getByTestId(testId).evaluate(
        (el) =>
            el
                .getAnimations()
                .map((a) => a.timeline?.constructor?.name)
                .find((name) => name === 'ViewTimeline' || name === 'ScrollTimeline') ?? 'none'
    )

test.describe('useScroll ViewTimeline offsets', () => {
    test('accelerate flags follow the offset rules', async ({ page }) => {
        await page.goto(URL)
        const supported = String(await page.evaluate(() => 'ViewTimeline' in window))
        await expect(page.getByTestId('cover-accelerated')).toHaveText(supported)
        await expect(page.getByTestId('enter-accelerated')).toHaveText(supported)
        // A ScrollTimeline can't express an offset (Motion 13.5.0).
        await expect(page.getByTestId('page-accelerated')).toHaveText('false')
    })

    test('the Enter offset runs on a native ViewTimeline (control)', async ({ page }) => {
        await page.goto(URL)
        test.skip(!(await page.evaluate(() => 'ViewTimeline' in window)), 'no ViewTimeline')
        await expect.poll(timelineOf(page, 'enter-box')).toBe('ViewTimeline')
    })

    test('the "in view" offset runs on a native ViewTimeline', async ({ page }) => {
        await page.goto(URL)
        test.skip(!(await page.evaluate(() => 'ViewTimeline' in window)), 'no ViewTimeline')
        await expect.poll(timelineOf(page, 'cover-box')).toBe('ViewTimeline')
    })

    test('a page useScroll with an offset stays on the JS path', async ({ page }) => {
        await page.goto(URL)
        // Give any native attachment time to happen before asserting absence.
        await page.waitForTimeout(500)
        expect(await timelineOf(page, 'page-box')()).toBe('none')
    })

    test('the "in view" box tracks scroll progress', async ({ page }) => {
        await page.goto(URL)
        const opacity = () =>
            page.getByTestId('cover-box').evaluate((el) => Number(getComputedStyle(el).opacity))
        // Before the box enters from the bottom: progress 0.
        await expect.poll(opacity).toBeCloseTo(0.2, 1)
        // Box vertically centred in the viewport: progress ≈ 0.5.
        await page.getByTestId('cover-box').evaluate((el) => {
            const rect = el.getBoundingClientRect()
            window.scrollBy(0, rect.top + rect.height / 2 - window.innerHeight / 2)
        })
        await expect.poll(opacity).toBeCloseTo(0.6, 1)
    })

    test('links the page from the test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: /useScroll ViewTimeline offsets/ })
        ).toHaveAttribute('href', /\/tests\/use-scroll\/view-timeline-offsets/)
    })
})
