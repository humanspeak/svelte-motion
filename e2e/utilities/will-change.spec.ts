import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/will-change?@isPlaywright=true'

const valueText = (page: Page, testId: string) => async () =>
    (await page.getByTestId(testId).textContent())?.trim() ?? ''

const computedWillChange = (page: Page, testId: string) => async () =>
    page.getByTestId(testId).evaluate((el) => getComputedStyle(el).willChange)

const computedBackground = (page: Page, testId: string) => async () =>
    page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor)

const waitForMotionReady = async (page: Page, testId: string) => {
    await expect(page.getByTestId(testId)).toHaveAttribute('data-is-loaded', 'ready')
}

test.describe('useWillChange (#327)', () => {
    test('flips will-change to "transform" when a transform prop animates', async ({ page }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'transform-box')

        // Idle: no transform has animated yet.
        await expect.poll(valueText(page, 'transform-value')).toBe('value: auto')
        await expect.poll(computedWillChange(page, 'transform-box')).toBe('auto')

        // Animate x → will-change becomes "transform" (MotionValue + DOM).
        await page.getByTestId('move').click()
        await expect.poll(valueText(page, 'transform-value')).toBe('value: transform')
        await expect.poll(computedWillChange(page, 'transform-box')).toBe('transform')

        // One-way latch: returning to x:0 still animates, but will-change stays
        // "transform" — it never reverts once promoted (matches upstream).
        await page.getByTestId('move').click()
        await expect.poll(valueText(page, 'transform-value')).toBe('value: transform')
        await expect.poll(computedWillChange(page, 'transform-box')).toBe('transform')
    })

    test('leaves will-change at "auto" for a backgroundColor animation (Motion 14.7)', async ({
        page
    }) => {
        // Upstream f9e080f21 took backgroundColor out of motion-dom's
        // acceleratedValues (motion-dom/src/animation/waapi/utils/accelerated-values.ts
        // @v14.7.1): colours animate in JS on the main thread, so they never
        // promote the element.
        await page.goto(URL)
        await waitForMotionReady(page, 'color-box')

        await expect.poll(valueText(page, 'color-value')).toBe('value: auto')
        await expect.poll(computedWillChange(page, 'color-box')).toBe('auto')

        // The colour really animates to its #f0abfc target...
        await page.getByTestId('recolor').click()
        await expect.poll(computedBackground(page, 'color-box')).toBe('rgb(240, 171, 252)')
        // ...without touching will-change.
        await expect.poll(computedWillChange(page, 'color-box')).toBe('auto')
        await expect.poll(valueText(page, 'color-value')).toBe('value: auto')

        // Back to #67e8f9: still no promotion.
        await page.getByTestId('recolor').click()
        await expect.poll(computedBackground(page, 'color-box')).toBe('rgb(103, 232, 249)')
        await expect.poll(computedWillChange(page, 'color-box')).toBe('auto')
        await expect.poll(valueText(page, 'color-value')).toBe('value: auto')
    })

    test('flips will-change via imperative animation controls', async ({ page }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'controls-box')

        await expect.poll(valueText(page, 'controls-value')).toBe('value: auto')
        await expect.poll(computedWillChange(page, 'controls-box')).toBe('auto')

        // controls.start({ x }) animates a transform → will-change becomes "transform".
        await page.getByTestId('run-controls').click()
        await expect.poll(valueText(page, 'controls-value')).toBe('value: transform')
        await expect.poll(computedWillChange(page, 'controls-box')).toBe('transform')
    })

    test('leaves will-change at "auto" for a nonaccelerated borderRadius animation', async ({
        page
    }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'border-radius-box')

        await expect.poll(valueText(page, 'border-radius-value')).toBe('value: auto')
        await expect.poll(computedWillChange(page, 'border-radius-box')).toBe('auto')

        await page.getByTestId('round').click()
        await expect.poll(computedWillChange(page, 'border-radius-box')).toBe('auto')
        await expect.poll(valueText(page, 'border-radius-value')).toBe('value: auto')

        // Reversing a nonaccelerated animation must not promote the element.
        await page.getByTestId('round').click()
        await expect.poll(computedWillChange(page, 'border-radius-box')).toBe('auto')
        await expect.poll(valueText(page, 'border-radius-value')).toBe('value: auto')
    })

    test('triggers the transform flip via keyboard activation', async ({ page }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'transform-box')

        await expect.poll(valueText(page, 'transform-value')).toBe('value: auto')

        // The control is a native button — Enter must drive the same animation.
        await page.getByTestId('move').focus()
        await page.keyboard.press('Enter')
        await expect.poll(valueText(page, 'transform-value')).toBe('value: transform')
        await expect.poll(computedWillChange(page, 'transform-box')).toBe('transform')
    })
})
