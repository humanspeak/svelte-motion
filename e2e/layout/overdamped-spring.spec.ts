import { expect, test } from '@playwright/test'

/**
 * https://github.com/motiondivision/motion/issues/1207
 *
 * A slow overdamped spring layout animation
 * ({ stiffness: 4, damping: 35, mass: 0.5 }) should keep easing smoothly
 * towards its target. Physically, its slow mode decays at ~0.115/s, so
 * ~10s after starting it should still be roughly two thirds of the way
 * there. Instead it suddenly snapped to the end ~8.6s in.
 *
 * Port of upstream `tests/react/issue-1207.spec.ts` @ `v14.7.1` (fix
 * `154d73c5b`, Motion 14.7), against
 * `src/routes/tests/layout/overdamped-spring/+page.svelte`, which records the
 * box once per painted frame (`onPaintedFrame`).
 */
type SpringWindow = Window & {
    samples: [number, number][]
    startSampling: () => void
    stopSampling: () => void
}

test.use({ viewport: { width: 1280, height: 720 } })

test('slow overdamped spring layout animation is not cut off (#1207) @slow', async ({ page }) => {
    test.slow()
    await page.goto('/tests/layout/overdamped-spring?@isPlaywright=true')
    const box = page.locator('#box')
    await expect(box).toBeVisible()

    // Start sampling the box position every frame from the click onwards
    await page.evaluate(() => (window as unknown as SpringWindow).startSampling())

    await page.waitForTimeout(10500)
    await page.evaluate(() => (window as unknown as SpringWindow).stopSampling())

    const samples: [number, number][] = await page.evaluate(
        () => (window as unknown as SpringWindow).samples
    )
    const startLeft = samples[0][1]
    const progressAt = (ms: number) => {
        const s = samples.find(([t]) => t >= ms)!
        return (s[1] - startLeft) / 1000
    }

    // Control: early in the animation the spring is clearly in motion
    expect(progressAt(5000)).toBeGreaterThan(0.3)
    expect(progressAt(5000)).toBeLessThan(0.6)

    // At ~10s the physical spring is still only ~2/3 of the way there
    expect(progressAt(10000)).toBeLessThan(0.8)

    // It never jumps: its peak speed is ~1px per frame
    let maxStep = 0
    for (let i = 1; i < samples.length; i++) {
        maxStep = Math.max(maxStep, samples[i][1] - samples[i - 1][1])
    }
    expect(maxStep).toBeLessThan(10)
})
