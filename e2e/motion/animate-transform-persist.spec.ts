import { expect, test } from '@playwright/test'
import { readTransform } from '../_helpers/transform'

/**
 * Regression for #377 — transform shortcuts must persist after the WAAPI
 * animation completes. Before the fix, `animate={{ scaleX: 0.5 }}` (and any
 * transform shortcut) animated correctly but reverted to `transform: none`
 * on completion, because the inline transform baseline was cleared at
 * `'ready'` and WAAPI's default `fill: 'none'` surrenders the property.
 *
 * All targets are non-identity so "reverted to none" is detectable
 * (an identity transform serializes to `none` either way).
 *
 * `readTransform` parses the computed `matrix(a,b,c,d,tx,ty)`:
 *   a = scaleX, d = scaleY, tx = translateX, ty = translateY.
 */

test.describe('motion/animate-transform-persist (#377)', () => {
    test('scaleX target persists at rest (does not revert to none)', async ({ page }) => {
        await page.goto('/tests/motion/animate-transform-persist?@isPlaywright=true')
        const sel = '[data-testid="persist-scalex"]'
        await page.locator(sel).waitFor({ state: 'visible' })

        // Settle, then assert the resting transform holds scaleX ≈ 0.5.
        await expect
            .poll(async () => (await readTransform(page, sel)).a, {
                timeout: 4000,
                message: 'scaleX never settled at its 0.5 target'
            })
            .toBeCloseTo(0.5, 1)

        // And it is NOT the reverted/identity state.
        const t = await page.locator(sel).evaluate((el) => getComputedStyle(el).transform)
        expect(t).not.toBe('none')
    })

    test('animates through an intermediate frame (no snap to target)', async ({ page }) => {
        await page.goto('/tests/motion/animate-transform-persist?@isPlaywright=true')
        const sel = '[data-testid="persist-rotate"]'
        await page.locator(sel).waitFor({ state: 'visible' })

        // Poll during the 0.6s animation for an intermediate rotation frame.
        // rotate(θ) -> matrix b = sin(θ); a partial frame has
        // 0 < b < sin(45deg). Proves it animates rather than jumping to 45deg.
        await expect
            .poll(
                async () => {
                    const t = await page
                        .locator(sel)
                        .evaluate((el) => getComputedStyle(el).transform)
                    const m = t.match(/matrix\(([^)]+)\)/)
                    if (!m) return false
                    const b = Math.abs(Number.parseFloat(m[1].split(',')[1]))
                    return b > 0.05 && b < 0.69
                },
                { timeout: 1200, message: 'never observed an intermediate rotation frame' }
            )
            .toBe(true)

        // Rests rotated (b ≈ sin(45°) ≈ 0.707), not reverted.
        await expect
            .poll(
                async () => {
                    const t = await page
                        .locator(sel)
                        .evaluate((el) => getComputedStyle(el).transform)
                    const m = t.match(/matrix\(([^)]+)\)/)
                    return m ? Number.parseFloat(m[1].split(',')[1]) : 0
                },
                { timeout: 4000, message: 'rotate never settled at 45°' }
            )
            .toBeCloseTo(0.707, 1)
    })

    test('does NOT snap to the target at the start of the animation', async ({ page }) => {
        // The fix's subtle failure mode: flipping the inline baseline to the
        // target mid-animation shows the target for one frame (a visible snap)
        // before WAAPI re-asserts. Polling from the test can't reliably catch a
        // 1-frame transient, so record every frame from mount via addInitScript
        // (runs before page JS) and assert no early frame is near the target.
        await page.addInitScript(() => {
            const frames: number[] = []
            ;(window as unknown as { __snapFrames: number[] }).__snapFrames = frames
            const el = () => document.querySelector('[data-testid="persist-rotate"]')
            const tick = () => {
                const node = el()
                if (node) {
                    const m = getComputedStyle(node).transform.match(/matrix\(([^)]+)\)/)
                    // matrix b = sin(theta); abs so direction doesn't matter.
                    if (m) frames.push(Math.abs(Number.parseFloat(m[1].split(',')[1])))
                }
                if (frames.length < 80) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        })

        // `?slow` → 4s linear: by ~1.2s a smooth ramp reaches only sin≈0.2,
        // whereas a one-frame snap to 45° would spike to sin≈0.707.
        await page.goto('/tests/motion/animate-transform-persist?slow&@isPlaywright=true')
        await page.locator('[data-testid="persist-rotate"]').waitFor({ state: 'visible' })
        await page.waitForTimeout(1300)

        const earlyMax = await page.evaluate(() => {
            const f = (window as unknown as { __snapFrames: number[] }).__snapFrames || []
            // First ~1.2s of frames (well before the 4s animation nears 45°).
            return Math.max(0, ...f.slice(0, 60))
        })
        expect(earlyMax).toBeLessThan(0.4)
    })

    test('keyframe-array target rests at the LAST element, not the first', async ({ page }) => {
        await page.goto('/tests/motion/animate-transform-persist?@isPlaywright=true')
        const sel = '[data-testid="persist-array"]'
        await page.locator(sel).waitFor({ state: 'visible' })

        // animate x: [0, 120, 60] → resting translateX is 60, not 0.
        await expect
            .poll(async () => (await readTransform(page, sel)).tx, {
                timeout: 4000,
                message: 'translateX never settled at the last keyframe (60)'
            })
            .toBeCloseTo(60, 0)
    })
})
