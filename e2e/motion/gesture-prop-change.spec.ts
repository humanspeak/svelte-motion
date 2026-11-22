import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Changing a gesture prop while the gesture is active (plan 006).
 *
 * Upstream keeps one Feature per gesture and reads props at event time
 * (`framer-motion/src/gestures/hover.ts`, `gestures/focus.ts`,
 * `motion/features/viewport/index.ts` at v14.14.0), so a new `whileHover`,
 * `whileFocus` or `whileInView` mid-gesture must not re-attach the gesture.
 * Tester page: `/tests/motion/gesture-prop-change`.
 */

/** Average x/y scale from the computed transform (copied from `tap-options.spec.ts`). */
const readScale = async (box: Locator) => {
    const t = await box.evaluate((el) => getComputedStyle(el).transform)
    if (!t || t === 'none') return 1
    try {
        if (t.startsWith('matrix(')) {
            const nums = t
                .slice('matrix('.length, -1)
                .split(',')
                .map((v) => parseFloat(v.trim()))
            if (nums.length < 4 || nums.slice(0, 4).some((n) => Number.isNaN(n))) return 1
            return (Math.hypot(nums[0], nums[1]) + Math.hypot(nums[2], nums[3])) / 2
        }
        if (t.startsWith('matrix3d(')) {
            const nums = t
                .slice('matrix3d('.length, -1)
                .split(',')
                .map((v) => parseFloat(v.trim()))
            if (nums.length !== 16 || nums.some((n) => Number.isNaN(n))) return 1
            return (
                (Math.hypot(nums[0], nums[1], nums[2]) + Math.hypot(nums[4], nums[5], nums[6])) / 2
            )
        }
        return 1
    } catch {
        return 1
    }
}

/** Move the mouse to the centre of `target`. */
const moveToCentre = async (page: Page, target: Locator) => {
    const bounds = await target.boundingBox()
    if (!bounds) throw new Error('no bounding box')
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

test.describe('gesture props changed mid-gesture', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/motion/gesture-prop-change?@isPlaywright=true')
        for (const id of ['hover-box', 'focus-box', 'in-view-box']) {
            await expect(page.getByTestId(id)).toHaveAttribute('data-is-loaded', 'ready')
        }
    })

    test('hover ends after whileHover changes mid-hover', async ({ page }) => {
        const box = page.getByTestId('hover-box')
        await moveToCentre(page, box)
        await expect(page.getByTestId('hover-starts')).toHaveText('1')
        await expect.poll(() => readScale(box)).toBeGreaterThan(1.15)

        await page.keyboard.press('h')
        await expect.poll(() => readScale(box)).toBeGreaterThan(1.35)

        await page.mouse.move(5, 5)
        await expect(page.getByTestId('hover-ends')).toHaveText('1')
        await expect.poll(() => readScale(box)).toBeLessThan(1.02)
        await expect(page.getByTestId('hover-starts')).toHaveText('1')
    })

    test('focus ends after whileFocus changes mid-focus', async ({ page }) => {
        const box = page.getByTestId('focus-box')
        await box.focus()
        await expect(page.getByTestId('focus-starts')).toHaveText('1')
        await expect.poll(() => readScale(box)).toBeGreaterThan(1.15)

        await page.keyboard.press('f')
        await expect.poll(() => readScale(box)).toBeGreaterThan(1.35)

        await box.evaluate((el) => (el as HTMLElement).blur())
        await expect(page.getByTestId('focus-ends')).toHaveText('1')
        await expect.poll(() => readScale(box)).toBeLessThan(1.02)
    })

    test('a once in-view fires once across a whileInView change', async ({ page }) => {
        const box = page.getByTestId('in-view-box')
        await expect(page.getByTestId('in-view-starts')).toHaveText('1')

        await page.keyboard.press('v')
        // Proves the new definition applied, and gives a fresh observer time
        // to report.
        await expect
            .poll(async () =>
                Math.abs(Number(await box.evaluate((el) => getComputedStyle(el).opacity)) - 0.9)
            )
            .toBeLessThan(0.02)
        await expect(page.getByTestId('in-view-starts')).toHaveText('1')
    })

    test('an amount change does not re-fire', async ({ page }) => {
        await expect(page.getByTestId('in-view-starts')).toHaveText('1')

        await page.getByTestId('toggle-amount').click()
        await expect(page.getByTestId('in-view-box')).toHaveAttribute('data-amount', '0.5')
        await page.evaluate(
            () =>
                new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                )
        )
        await expect(page.getByTestId('in-view-starts')).toHaveText('1')
    })
})
