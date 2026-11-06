import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Motion 14.10 `tap` prop: `count` (double tap), `hold` (long press) and
 * `repeat` (auto-repeating stepper), driven through motion-dom's `press()`.
 *
 * Port of upstream `framer-motion/src/gestures/__tests__/press-options.test.tsx`
 * at v14.10.1, against the tester page `/tests/motion/tap-options`.
 */

/** Average x/y scale from the computed transform (copied from `rapid-tap.test.ts`). */
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

test.describe('tap prop (count, hold, repeat)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/motion/tap-options?@isPlaywright=true')
        await expect(page.getByTestId('double')).toBeVisible()
    })

    test('count: 2 — one click does nothing, a quick double click fires onTap once', async ({
        page
    }) => {
        const double = page.getByTestId('double')
        await moveToCentre(page, double)

        await page.mouse.down()
        await page.mouse.up()
        // Wait past countTimeout (0.3s) so the lone click resolves.
        await page.waitForTimeout(500)
        await expect(page.getByTestId('double-tap')).toHaveText('0')
        await expect(page.getByTestId('double-cancel')).toHaveText('1')

        await page.mouse.down()
        await page.mouse.up()
        await page.waitForTimeout(100)
        await page.mouse.down()
        await page.mouse.up()
        await expect(page.getByTestId('double-tap')).toHaveText('1')
    })

    test('hold: 0.5 — a short click cancels, a long hold fires onTap', async ({ page }) => {
        const long = page.getByTestId('long')
        await moveToCentre(page, long)

        await page.mouse.down()
        await page.waitForTimeout(100)
        await page.mouse.up()
        await expect(page.getByTestId('long-cancel')).toHaveText('1')
        await expect(page.getByTestId('long-tap')).toHaveText('0')

        await page.mouse.down()
        await page.waitForTimeout(700)
        await page.mouse.up()
        await expect(page.getByTestId('long-tap')).toHaveText('1')
        await expect(page.getByTestId('long-cancel')).toHaveText('1')
    })

    test('repeat: 0.1 — holding fires onTap repeatedly and keeps whileTap active', async ({
        page
    }) => {
        const stepper = page.getByTestId('stepper')
        await moveToCentre(page, stepper)

        await page.mouse.down()
        await page.waitForTimeout(550)
        const value = Number(await page.getByTestId('stepper-value').textContent())
        expect(value).toBeGreaterThanOrEqual(3)
        // whileTap stays active across repeats.
        expect(await readScale(stepper)).toBeLessThan(1)
        await page.mouse.up()
    })

    test('keyboard: Enter twice quickly completes a count: 2 tap', async ({ page }) => {
        const double = page.getByTestId('double')
        await double.focus()
        await page.keyboard.press('Enter')
        await page.keyboard.press('Enter')
        await expect(page.getByTestId('double-tap')).toHaveText('1')
    })
})
