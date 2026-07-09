import { expect, test } from '@playwright/test'

/**
 * Regression guard for the tap-transition parity change: the default tap
 * press/release now delegates to motion-dom's per-value spring defaults instead
 * of a hardcoded tween. Springs were historically avoided here because rapid
 * press/release could pump velocity into the spring and cause the scale to run
 * away (see the old "Hold on run away code" guard in git history). Because every
 * animate() call reuses the same motion values, velocity is now continuous and
 * interrupts cleanly — this test hammers the element and asserts the scale stays
 * bounded and settles back to rest.
 */
test.describe('Rapid tap (spring runaway guard)', () => {
    const readScale = async (box: import('@playwright/test').Locator) => {
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
                    (Math.hypot(nums[0], nums[1], nums[2]) +
                        Math.hypot(nums[4], nums[5], nums[6])) /
                    2
                )
            }
            return 1
        } catch {
            return 1
        }
    }

    test('rapid press/release stays bounded and settles back to rest', async ({ page }) => {
        await page.goto('/tests/motion/rapid-tap?@isPlaywright=true')

        const box = page.getByTestId('motion-rapid-tap')
        await expect(box).toBeVisible()

        const bounds = await box.boundingBox()
        if (!bounds) throw new Error('no bounding box')
        const cx = bounds.x + bounds.width / 2
        const cy = bounds.y + bounds.height / 2
        await page.mouse.move(cx, cy)

        // Hammer press/release at roughly the spring's resonant cadence — the
        // exact condition that pumped the historical runaway.
        let maxScale = 1
        for (let i = 0; i < 25; i++) {
            await page.mouse.down()
            await page.waitForTimeout(60)
            maxScale = Math.max(maxScale, await readScale(box))
            await page.mouse.up()
            await page.waitForTimeout(60)
            maxScale = Math.max(maxScale, await readScale(box))
        }

        // whileTap is scale: 0.9 (shrinks). No sane spring should ever push the
        // element meaningfully ABOVE its resting size, and it must never run away.
        // A generous 1.25 ceiling catches a runaway while tolerating the intended
        // mild spring overshoot on release.
        expect(maxScale).toBeLessThan(1.25)

        // After the final release, the spring must settle back to rest (~1).
        await expect.poll(() => readScale(box), { timeout: 2000 }).toBeGreaterThan(0.97)
        await expect.poll(() => readScale(box), { timeout: 2000 }).toBeLessThan(1.03)
    })
})
