import { expect, test } from '@playwright/test'

/**
 * Upstream fidelity: gesture channels ride persistent MotionValues, so
 * interrupting a spring re-targets the SAME value and POSITION **and VELOCITY**
 * carry into the next animation (`animateMotionValue` seeds the generator with
 * `value.getVelocity()`).
 *
 * The box hovers to `scale: 1.5` (spring, no explicit transition) and taps to
 * `scale: 0.9`. Pressing mid-flight — while the hover spring is still climbing
 * with a high upward velocity — must launch the retarget toward 0.9 FROM that
 * positive velocity. Momentum therefore carries the scale UP for at least one
 * more frame before it reverses (the overshoot-then-reverse signature of a
 * velocity-preserving handoff). Under the old re-seeding writer the new
 * animation started from zero velocity, so the scale reversed immediately and
 * this signature was impossible.
 *
 * The interaction is driven entirely in-page with synthetic pointer events
 * inside one `requestAnimationFrame` loop. The 550/30 scale spring settles in
 * ~150ms, so the high-velocity window is only a few frames wide — far narrower
 * than Playwright's per-command protocol latency. Driving hover/press in-page
 * lets the press fire on the exact frame the spring crosses the mid-flight
 * threshold and samples the very next frames with no round-trip gap that could
 * swallow the 1–2 frame carry. motion-dom's `hover()` binds `pointerenter` and
 * `press()` binds `pointerdown`; both accept a synthetic primary-mouse
 * `PointerEvent`.
 */
test.describe('Hover→tap velocity continuity', () => {
    const SEL = '[data-testid="motion-hover-velocity-continuity"]'

    const readScale = (box: import('@playwright/test').Locator) =>
        box.evaluate((el) => {
            const t = getComputedStyle(el).transform
            if (!t || t === 'none') return 1
            const m = t.match(/matrix\(([^)]+)\)/)
            if (!m) return 1
            const [a, b] = m[1].split(',').map((v) => parseFloat(v.trim()))
            return Math.hypot(a, b)
        })

    test('mid-hover press carries velocity: scale climbs before reversing', async ({ page }) => {
        await page.goto('/tests/motion/hover-velocity-continuity?@isPlaywright=true')

        const box = page.getByTestId('motion-hover-velocity-continuity')
        await expect(box).toBeVisible()
        // Let hydration finish: a hover fired before listeners attach is lost.
        await page.waitForTimeout(800)

        const initial = await readScale(box)
        expect(Math.abs(initial - 1)).toBeLessThan(0.01)

        // Drive hover → mid-flight press → sampling in one in-page rAF loop.
        // The press fires the first frame the scale crosses 1.15 (spring still
        // climbing hard toward 1.5), and the next frames are sampled with no
        // protocol gap.
        const { samples, pressIndex, pressScale } = await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement
            const read = () => {
                const t = getComputedStyle(el).transform
                const m = t.match(/matrix\(([^)]+)\)/)
                if (!m) return 1
                const p = m[1].split(',').map((v) => parseFloat(v.trim()))
                return Math.hypot(p[0] ?? 1, p[1] ?? 0)
            }
            const pe = (type: string) =>
                new PointerEvent(type, {
                    pointerType: 'mouse',
                    isPrimary: true,
                    button: 0,
                    buttons: type === 'pointerdown' ? 1 : 0,
                    bubbles: true
                })
            return new Promise<{ samples: number[]; pressIndex: number; pressScale: number }>(
                (resolve) => {
                    const out: number[] = []
                    let pressIndex = -1
                    let pressScale = -1
                    el.dispatchEvent(pe('pointerenter'))
                    const start = performance.now()
                    const tick = () => {
                        const s = read()
                        out.push(s)
                        if (pressIndex === -1 && s > 1.15) {
                            pressScale = s
                            pressIndex = out.length
                            el.dispatchEvent(pe('pointerdown'))
                        }
                        if (performance.now() - start < 400) requestAnimationFrame(tick)
                        else {
                            window.dispatchEvent(pe('pointerup'))
                            resolve({ samples: out, pressIndex, pressScale })
                        }
                    }
                    requestAnimationFrame(tick)
                }
            )
        }, SEL)

        // The press must have fired mid-climb — genuinely between rest and the
        // 1.5 target with plenty of upward velocity left, never at the peak.
        expect(pressIndex).toBeGreaterThan(0)
        expect(pressScale).toBeGreaterThan(1.1)
        expect(pressScale).toBeLessThan(1.4)

        const post = samples.slice(pressIndex)
        expect(post.length).toBeGreaterThan(6)

        // Position continuity (co-test): the first post-press frame must not snap
        // DOWN toward motion's stale internal value (~1.0) — the seeded keyframe
        // keeps it at the frozen visual scale. A re-seed-to-stale snap would drop
        // it far below pressScale. (Upward motion is the carried velocity, not a
        // violation, so this guard is one-sided.)
        expect(post[0]).toBeGreaterThan(pressScale - 0.03)

        // Velocity continuity (the red anchor): the hover spring's carried upward
        // velocity must lift the scale ABOVE the press point for at least one
        // frame before it reverses toward 0.9 (overshoot-then-reverse). The
        // momentum is high enough that the overshoot peak can land on the very
        // first post-press frame, so the early maximum — not a later sample — is
        // what must exceed pressScale. Zero-velocity re-seeding reverses
        // immediately, so every post-press sample stays at or below pressScale.
        const earlyMax = Math.max(...post.slice(0, 7))
        expect(earlyMax).toBeGreaterThan(pressScale + 0.01)

        // And it does reverse: the spring settles back down toward the 0.9 tap
        // target rather than running away upward.
        expect(Math.min(...post)).toBeLessThan(pressScale)
    })

    test('tap cancel (release outside) never snaps to the frozen hover value', async ({ page }) => {
        await page.goto('/tests/motion/hover-velocity-continuity?@isPlaywright=true')

        const box = page.getByTestId('motion-hover-velocity-continuity')
        await expect(box).toBeVisible()
        await page.waitForTimeout(800)

        // Hold → drag off (hover ends while tap owns scale) → release OUTSIDE
        // (tap cancels). The reset must animate from the held 0.9 toward base
        // with no discontinuity. The regression: the hover channel's persistent
        // MotionValue froze near 1.5 when the press interrupted it, and the
        // cancel path re-emitted that stale value through the composed writer
        // for one frame (0.9 -> ~1.47) before the reset spring took over.
        const { maxStep, stepAt, series } = await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement
            const read = () => {
                const t = getComputedStyle(el).transform
                const m = t.match(/matrix\(([^)]+)\)/)
                if (!m) return 1
                const p = m[1].split(',').map((v) => parseFloat(v.trim()))
                return Math.hypot(p[0] ?? 1, p[1] ?? 0)
            }
            const pe = (type: string) =>
                new PointerEvent(type, {
                    pointerType: 'mouse',
                    isPrimary: true,
                    button: 0,
                    buttons: type === 'pointerdown' ? 1 : 0,
                    bubbles: true
                })
            const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
            return (async () => {
                const series: number[] = []
                const sampler = setInterval(() => series.push(read()), 16)
                el.dispatchEvent(pe('pointerenter'))
                await wait(700) // settle at hover 1.5
                el.dispatchEvent(pe('pointerdown'))
                await wait(400) // settle at tap 0.9 (held)
                el.dispatchEvent(pe('pointerleave'))
                await wait(400) // hover ends; scale stays tap-owned at 0.9
                window.dispatchEvent(pe('pointerup')) // cancel: released outside
                await wait(700) // reset spring to base
                clearInterval(sampler)
                let maxStep = 0
                let stepAt = -1
                for (let i = 1; i < series.length; i++) {
                    const step = Math.abs(series[i] - series[i - 1])
                    if (step > maxStep) {
                        maxStep = step
                        stepAt = i
                    }
                }
                return { maxStep, stepAt, series }
            })()
        }, SEL)

        // The default 500-550 stiffness springs peak well under 0.12/frame on
        // this travel; the frozen-value re-emit was a 0.57 single-frame snap.
        expect(
            maxStep,
            `max single-frame step ${maxStep.toFixed(3)} at sample ${stepAt} (series tail: ${series
                .slice(Math.max(0, stepAt - 3), stepAt + 3)
                .map((v) => v.toFixed(3))
                .join(' -> ')})`
        ).toBeLessThan(0.12)

        // And the cancel actually resets: settles back at base scale 1.
        expect(Math.abs(series[series.length - 1] - 1)).toBeLessThan(0.02)
    })
})
