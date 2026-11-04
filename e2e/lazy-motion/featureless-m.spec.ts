import { expect, test, type Locator, type Page } from '@playwright/test'

// Plan 016 (Motion parity). Upstream (Motion 14.7.1 `render/components/m/create.ts`,
// `motion/utils/use-visual-element.ts`) an `m` without LazyMotion features has
// no VisualElement: it renders `initial` and does nothing else, and once an
// async bundle loads it animates in from `initial`.
//
// Visual claims are read on every painted frame: an in-page
// `requestAnimationFrame` loop reads the computed style after motion-dom's
// frameloop has written that frame.

/** The x scale of the element's computed transform (1 when there is none). */
const scaleOf = (box: Locator) =>
    box.evaluate((el) => {
        const transform = getComputedStyle(el).transform
        if (!transform || transform === 'none') return 1
        return new DOMMatrixReadOnly(transform).a
    })

/**
 * Reads `testId`'s computed opacity on each of the next `frames` frames. When
 * `click` is given, that element is clicked first, in the same task.
 */
const opacityFrames = (page: Page, testId: string, frames: number, click?: string) =>
    page.evaluate(
        ([testId, frames, click]) =>
            new Promise<number[]>((resolve) => {
                const out: number[] = []
                const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!
                const step = () => {
                    out.push(Number(getComputedStyle(el).opacity))
                    if (out.length >= frames) resolve(out)
                    else requestAnimationFrame(step)
                }
                if (click) document.querySelector<HTMLElement>(`[data-testid="${click}"]`)!.click()
                requestAnimationFrame(step)
            }),
        [testId, frames, click] as const
    )

/** Hovers the box and returns its scale after the hover transition has had time to run. */
const scaleAfterHover = async (page: Page, box: Locator) => {
    await box.hover()
    await page.waitForTimeout(800)
    return scaleOf(box)
}

const allNear = (values: number[], target: number) =>
    values.every((value) => Math.abs(value - target) < 0.01)

test.describe('LazyMotion: m without features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/lazy-motion/featureless-m?@isPlaywright=true')
        await expect(page.getByTestId('card-control')).toBeVisible()
        await page.waitForFunction(() => window.MotionIsMounted === true)
    })

    test('a bare m keeps initial and ignores hover', async ({ page }) => {
        const box = page.getByTestId('card-bare')

        const frames = await opacityFrames(page, 'card-bare', 60)
        expect(allNear(frames, 0.4), frames.join(', ')).toBe(true)
        expect(await scaleAfterHover(page, box)).toBeCloseTo(0.8, 2)
    })

    test('an m in an async LazyMotion waits for its bundle, then animates in', async ({ page }) => {
        const box = page.getByTestId('card-async')

        const pending = await opacityFrames(page, 'card-async', 60)
        expect(allNear(pending, 0.4), pending.join(', ')).toBe(true)
        expect(await scaleAfterHover(page, box)).toBeCloseTo(0.8, 2)

        await page.mouse.move(0, 0)
        // Every frame from the click until the box settles (at most 3 s).
        const rise = await page.evaluate(
            () =>
                new Promise<number[]>((resolve) => {
                    const out: number[] = []
                    const el = document.querySelector<HTMLElement>('[data-testid="card-async"]')!
                    const start = performance.now()
                    const step = () => {
                        const value = Number(getComputedStyle(el).opacity)
                        out.push(value)
                        if (value >= 0.999 || performance.now() - start > 3000) resolve(out)
                        else requestAnimationFrame(step)
                    }
                    document.querySelector<HTMLElement>('[data-testid="load"]')!.click()
                    requestAnimationFrame(step)
                })
        )
        const trace = rise.map((value) => value.toFixed(3)).join(', ')
        expect(Math.abs(rise[0] - 0.4), trace).toBeLessThan(0.01)
        expect(rise[rise.length - 1], trace).toBeGreaterThan(0.99)
        expect(rise.length, trace).toBeGreaterThan(3)
        for (let i = 1; i < rise.length; i++) {
            expect(rise[i], trace).toBeGreaterThanOrEqual(rise[i - 1] - 0.001)
        }
        await expect.poll(() => scaleAfterHover(page, box)).toBeCloseTo(1.15, 2)
    })

    // Guard: a sync `domAnimation` bundle animates and hovers.
    test('the control m animates in and scales on hover', async ({ page }) => {
        const box = page.getByTestId('card-control')

        await expect
            .poll(() => box.evaluate((el) => Number(getComputedStyle(el).opacity)))
            .toBeCloseTo(1, 2)
        await expect.poll(() => scaleAfterHover(page, box)).toBeCloseTo(1.15, 2)
    })
})
