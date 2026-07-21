import { expect, test } from '@playwright/test'

test.describe('Hover + Tap', () => {
    test('hover scales up, tap scales down, then returns to hover scale on release', async ({
        page
    }) => {
        await page.goto('/tests/motion/hover-and-tap?@isPlaywright=true')

        const box = page.getByTestId('motion-hover-and-tap')
        await expect(box).toBeVisible()

        // Helper to read current scale from computed transform
        const readScale = async () => {
            const t = await box.evaluate((el) => getComputedStyle(el).transform)
            if (!t || t === 'none') return 1
            try {
                if (t.startsWith('matrix3d(')) {
                    const raw = t.slice('matrix3d('.length, -1)
                    const nums = raw.split(',').map((v) => parseFloat(v.trim()))
                    if (nums.length !== 16 || nums.some((n) => Number.isNaN(n))) return 1
                    const m11 = nums[0]
                    const m12 = nums[1]
                    const m13 = nums[2]
                    const m21 = nums[4]
                    const m22 = nums[5]
                    const m23 = nums[6]
                    const scaleX = Math.hypot(m11, m12, m13)
                    const scaleY = Math.hypot(m21, m22, m23)
                    return (scaleX + scaleY) / 2
                }
                if (t.startsWith('matrix(')) {
                    const raw = t.slice('matrix('.length, -1)
                    const nums = raw.split(',').map((v) => parseFloat(v.trim()))
                    if (nums.length < 4 || nums.slice(0, 4).some((n) => Number.isNaN(n))) return 1
                    const a = nums[0]
                    const b = nums[1]
                    const c = nums[2]
                    const d = nums[3]
                    const scaleX = Math.hypot(a, b)
                    const scaleY = Math.hypot(c, d)
                    return (scaleX + scaleY) / 2
                }
                return 1
            } catch {
                return 1
            }
        }

        // Initial scale is ~1 (identity transform may be expressed as matrix(...))
        const initialScale = await readScale()
        expect(Math.abs(initialScale - 1)).toBeLessThan(0.01)

        // Hover: scale increases towards 1.2
        await box.hover()
        await expect.poll(readScale).toBeGreaterThan(1.1)

        // Tap (pointerdown): scale to 0.8 using real mouse input
        await page.mouse.down()
        await expect.poll(readScale).toBeLessThan(0.9)

        // Release (pointerup): should return to hover scale (≈1.2), not initial
        await page.mouse.up()
        await expect.poll(readScale).toBeGreaterThan(1.05)
    })

    test('returns to rest smoothly when the pointer leaves mid-release-spring', async ({
        page
    }) => {
        await page.goto('/tests/motion/hover-and-tap?@isPlaywright=true')

        const box = page.getByTestId('motion-hover-and-tap')
        await expect(box).toBeVisible()
        // Let hydration finish before the first pointer event: a hover fired
        // before listeners attach is silently lost (the pointer never moves
        // again, so it can't re-fire) and would mask the real defect.
        await page.waitForTimeout(800)

        const readScale = () =>
            box.evaluate((el) => {
                const t = getComputedStyle(el).transform
                const match = t.match(/matrix\(([^)]+)\)/)
                if (!match) return 1
                const n = match[1].split(',').map((v) => parseFloat(v.trim()))
                return (Math.hypot(n[0], n[1]) + Math.hypot(n[2], n[3])) / 2
            })

        // hover → engaged, then tap and release so the box is springing back
        // toward the hover scale when the pointer leaves.
        await box.hover()
        await expect.poll(readScale).toBeGreaterThan(1.19)
        await page.mouse.down()
        await expect.poll(readScale).toBeLessThan(0.85)
        await page.mouse.up()

        // Sample the computed scale every frame (absolute clock, so the leave
        // moment can be marked from the outside) while the gesture unwinds.
        const samplesPromise = box.evaluate(
            (el) =>
                new Promise<Array<{ t: number; s: number }>>((resolve) => {
                    const out: Array<{ t: number; s: number }> = []
                    const t0 = performance.now()
                    const read = () => {
                        const t = getComputedStyle(el).transform
                        let s = 1
                        const match = t.match(/matrix\(([^)]+)\)/)
                        if (match) {
                            const n = match[1].split(',').map((v) => parseFloat(v.trim()))
                            s = (Math.hypot(n[0], n[1]) + Math.hypot(n[2], n[3])) / 2
                        }
                        out.push({ t: performance.now(), s })
                        if (performance.now() - t0 < 1600) requestAnimationFrame(read)
                        else resolve(out)
                    }
                    requestAnimationFrame(read)
                })
        )

        // Leave mid-release-spring: the box must retarget and SPRING to the
        // resting scale — never jump there. The release spring itself is
        // deliberately snappy (motion-dom's scale spring), so smoothness is
        // asserted only from the leave onward.
        await page.waitForTimeout(120)
        const leaveAt = await page.evaluate(() => performance.now())
        await page.mouse.move(5, 5)
        const samples = await samplesPromise

        // The unwind (hover-exit back to rest) is a short tween/spring whose
        // frame-to-frame step stays well under 0.06; a snap shows up as a
        // single-step cliff.
        const unwind = samples.filter((sample) => sample.t > leaveAt + 30)
        expect(unwind.length, 'sampler must cover the unwind window').toBeGreaterThan(10)
        let maxStep = 0
        let cliffAt = 0
        for (let i = 1; i < unwind.length; i++) {
            const step = Math.abs(unwind[i].s - unwind[i - 1].s)
            if (step > maxStep) {
                maxStep = step
                cliffAt = unwind[i].t - leaveAt
            }
        }
        const finalScale = unwind[unwind.length - 1].s
        expect(Math.abs(finalScale - 1), 'box must settle at resting scale').toBeLessThan(0.02)
        expect(
            maxStep,
            `scale must unwind smoothly after pointer leave — found a ${maxStep.toFixed(3)} jump ${Math.round(cliffAt)}ms after leave`
        ).toBeLessThan(0.06)
    })
})
