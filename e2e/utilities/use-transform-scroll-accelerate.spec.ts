import { expect, test } from '@playwright/test'

const URL = '/tests/use-transform/scroll-accelerate?@isPlaywright=true'

const hasScrollTimelineAnimation = (page: import('@playwright/test').Page, testId: string) =>
    page
        .getByTestId(testId)
        .evaluate((el) =>
            el.getAnimations().some((a) => a.timeline?.constructor?.name === 'ScrollTimeline')
        )

test.describe('useTransform scroll acceleration', () => {
    test('accelerated flags reflect native support and the guards', async ({ page }) => {
        await page.goto(URL)
        const supported = await page.evaluate(() => 'ScrollTimeline' in window)
        const expected = String(supported)
        await expect(page.getByTestId('direct-accelerated')).toHaveText(expected)
        await expect(page.getByTestId('bg-accelerated')).toHaveText(expected)
        await expect(page.getByTestId('partial-accelerated')).toHaveText(expected)
        await expect(page.getByTestId('chained-accelerated')).toHaveText('false')
        await expect(page.getByTestId('descending-accelerated')).toHaveText('false')
    })

    test('a native scroll-timeline animation drives the element', async ({ page }) => {
        await page.goto(URL)
        const supported = await page.evaluate(() => 'ScrollTimeline' in window)
        test.skip(!supported, 'ScrollTimeline not supported')
        await expect.poll(() => hasScrollTimelineAnimation(page, 'partial')).toBe(true)
        expect(await hasScrollTimelineAnimation(page, 'chained')).toBe(false)
    })

    test('partial range holds its end values (motion#3857)', async ({ page }) => {
        await page.goto(URL)
        const supported = await page.evaluate(() => 'ScrollTimeline' in window)
        test.skip(!supported, 'ScrollTimeline not supported')
        const opacity = () =>
            page.getByTestId('partial').evaluate((el) => getComputedStyle(el).opacity)

        await page.evaluate(() => window.scrollTo(0, 0))
        await expect.poll(opacity).toBe('0.2')
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await expect.poll(opacity).toBe('1')
    })

    test('no page errors across load and a full scroll', async ({ page }) => {
        const errors: Error[] = []
        page.on('pageerror', (error) => errors.push(error))
        await page.goto(URL)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.waitForTimeout(200)
        expect(errors).toEqual([])
    })
})
