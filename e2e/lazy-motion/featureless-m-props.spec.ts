import { expect, test } from '@playwright/test'

// Plan 016 (Motion parity). Upstream (Motion 14.7.1) a featureless `m` has no
// VisualElement but still renders its props: `tabIndex = 0` from `onTap` /
// `onTapStart` / `whileTap` (`render/html/use-props.ts:76-81`), a style
// MotionValue's first-render value (`use-props.ts:9-49`) and SVG attributes
// from `initial` (`render/svg/use-props.ts:10-40`). It never reacts.
//
// Visual claims are read on every painted frame (an in-page
// `requestAnimationFrame` loop) and asserted on every record.

test.describe('LazyMotion: featureless m props', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/lazy-motion/featureless-m-props?@isPlaywright=true')
        await page.waitForFunction(() => window.MotionIsMounted === true)
    })

    test('tap props make every box focusable', async ({ page }) => {
        for (const testId of ['tap-bare', 'tap-control', 'tap-dommin']) {
            await expect(page.getByTestId(testId)).toHaveAttribute('tabindex', '0')
        }
        await page.getByTestId('tap-bare').focus()
        await page.keyboard.press('Tab')
        expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
            'tap-control'
        )
        await page.keyboard.press('Tab')
        expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
            'tap-dommin'
        )
    })

    test('a tap on a featureless m does nothing', async ({ page }) => {
        await page.getByTestId('tap-bare').click()
        await page.getByTestId('tap-control').click()

        await expect(page.getByTestId('tap-control-count')).toHaveText('1')
        await page.waitForTimeout(200)
        await expect(page.getByTestId('tap-bare-count')).toHaveText('0')
    })

    test("a style MotionValue doesn't move a featureless m", async ({ page }) => {
        const frames = await page.evaluate(
            () =>
                new Promise<{ hitsBare: boolean; controlX: number }[]>((resolve) => {
                    const bare = document.querySelector<HTMLElement>('[data-testid="style-bare"]')!
                    const control = document.querySelector<HTMLElement>(
                        '[data-testid="style-control"]'
                    )!
                    const rest = bare.getBoundingClientRect()
                    const cx = rest.left + rest.width / 2
                    const cy = rest.top + rest.height / 2
                    const out: { hitsBare: boolean; controlX: number }[] = []
                    const step = () => {
                        const hit = document.elementFromPoint(cx, cy)
                        const transform = getComputedStyle(control).transform
                        out.push({
                            hitsBare: !!hit && (hit === bare || bare.contains(hit)),
                            controlX:
                                !transform || transform === 'none'
                                    ? 0
                                    : new DOMMatrixReadOnly(transform).e
                        })
                        if (out.length >= 60) resolve(out)
                        else requestAnimationFrame(step)
                    }
                    document.querySelector<HTMLElement>('[data-testid="nudge"]')!.click()
                    requestAnimationFrame(step)
                })
        )
        const trace = JSON.stringify(frames)
        expect(
            frames.every((frame) => frame.hitsBare),
            trace
        ).toBe(true)
        expect(
            frames.some((frame) => Math.abs(frame.controlX - 120) < 0.5),
            trace
        ).toBe(true)
    })

    test('a featureless m.path is painted and stays short', async ({ page }) => {
        const frames = await page.evaluate(
            () =>
                new Promise<{ visibility: string; bare: string; control: string }[]>((resolve) => {
                    const bare = document.querySelector('[data-testid="path-bare"]')!
                    const control = document.querySelector('[data-testid="path-control"]')!
                    const out: { visibility: string; bare: string; control: string }[] = []
                    const step = () => {
                        const style = getComputedStyle(bare)
                        out.push({
                            visibility: style.visibility,
                            bare: style.strokeDasharray,
                            control: getComputedStyle(control).strokeDasharray
                        })
                        if (out.length >= 60) resolve(out)
                        else requestAnimationFrame(step)
                    }
                    requestAnimationFrame(step)
                })
        )
        const trace = JSON.stringify(frames)
        expect(
            frames.every((frame) => frame.visibility !== 'hidden'),
            trace
        ).toBe(true)
        expect(
            frames.every((frame) => frame.bare === frames[0].bare),
            trace
        ).toBe(true)
        expect(new Set(frames.map((frame) => frame.control)).size, trace).toBeGreaterThan(1)
    })
})
