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

        // Computed opacity alone can't see missing 0/1 padding (the JS path also
        // writes inline opacity), so assert the native animation's keyframes.
        const keyframes = () =>
            page.getByTestId('partial').evaluate((el) => {
                const animation = el
                    .getAnimations()
                    .find((a) => a.timeline?.constructor?.name === 'ScrollTimeline')
                const frames = (animation?.effect as KeyframeEffect | undefined)?.getKeyframes()
                return frames?.map((f) => ({ offset: f.offset, opacity: String(f.opacity) }))
            })
        await expect.poll(keyframes).toEqual([
            { offset: 0, opacity: '0.2' },
            { offset: 0.25, opacity: '0.2' },
            { offset: 0.5, opacity: '1' },
            { offset: 1, opacity: '1' }
        ])
    })

    test('a scroll-linked backgroundColor updates in JS, not as a native ScrollTimeline animation (Motion 14.7)', async ({
        page
    }) => {
        // Upstream f9e080f21 removed backgroundColor from acceleratedValues, and
        // a value with an accelerate config only gets a native animation when
        // `value.accelerate && acceleratedValues.has(key)`
        // (motion-dom/src/render/VisualElement.ts:557-563 @v14.7.1).
        await page.goto(URL)
        const supported = await page.evaluate(() => 'ScrollTimeline' in window)
        test.skip(!supported, 'ScrollTimeline not supported')

        const scrollTimelineProps = () =>
            page.getByTestId('direct').evaluate((el) =>
                el
                    .getAnimations()
                    .filter((a) => a.timeline?.constructor?.name === 'ScrollTimeline')
                    .flatMap((a) =>
                        ((a.effect as KeyframeEffect | null)?.getKeyframes() ?? []).flatMap((f) =>
                            Object.keys(f)
                        )
                    )
            )

        // Guard: acceleration is live (opacity runs natively on `direct`).
        await expect.poll(scrollTimelineProps).toContain('opacity')
        const props = await scrollTimelineProps()
        expect(props).not.toContain('backgroundColor')
        expect(props).not.toContain('background-color')

        // The colour still follows the scroll, in JS.
        const background = () =>
            page.getByTestId('direct').evaluate((el) => getComputedStyle(el).backgroundColor)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await expect.poll(background).not.toBe('rgb(255, 0, 0)')
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
