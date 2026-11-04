import { expect, test, type Page } from '@playwright/test'

type Frame = { opacity: number; scale: number }

/**
 * Reads `testId`'s computed opacity and x scale on each of the next `frames`
 * painted frames (an in-page `requestAnimationFrame` loop, after motion-dom's
 * frameloop has written the frame).
 */
const probeFrames = (page: Page, testId: string, frames: number) =>
    page.evaluate(
        ([testId, frames]) =>
            new Promise<Frame[]>((resolve) => {
                const out: Frame[] = []
                const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!
                const step = () => {
                    const style = getComputedStyle(el)
                    const transform = style.transform
                    out.push({
                        opacity: Number(style.opacity),
                        scale:
                            !transform || transform === 'none'
                                ? 1
                                : new DOMMatrixReadOnly(transform).a
                    })
                    if (out.length >= frames) resolve(out)
                    else requestAnimationFrame(step)
                }
                requestAnimationFrame(step)
            }),
        [testId, frames] as const
    )

const trace = (frames: Frame[]) =>
    frames.map((f) => `${f.opacity.toFixed(2)}/${f.scale.toFixed(3)}`).join(', ')

test.describe('LazyMotion', () => {
    test('renders m namespace components with domAnimation', async ({ page }) => {
        await page.goto('/tests/lazy-motion/basic?@isPlaywright=true')

        const box = page.getByTestId('lazy-motion-basic-box')
        await expect(box).toBeVisible()
        await expect.poll(() => box.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    })

    // `tabindex` is prop-derived (upstream `render/html/use-props.ts:76-81`), so
    // the bundles differ in behaviour: only gesture bundles react to hover.
    test('gates gestures by feature bundle', async ({ page }) => {
        await page.goto('/tests/lazy-motion/feature-bundles?@isPlaywright=true')
        await page.waitForFunction(() => window.MotionIsMounted === true)

        const cards = [
            ['lazy-motion-domMin', false],
            ['lazy-motion-domAnimation', true],
            ['lazy-motion-domMax', true],
            // A `motion` component ignores LazyMotion and keeps every feature.
            ['lazy-motion-motion-in-domMin', true]
        ] as const

        for (const [testId] of cards) {
            const card = page.getByTestId(testId)
            await expect
                .poll(() => card.evaluate((el) => Number(getComputedStyle(el).opacity)))
                .toBeCloseTo(1, 2)
        }

        for (const [testId, hovers] of cards) {
            await page.getByTestId(testId).hover()
            const frames = await probeFrames(page, testId, 45)
            if (hovers) {
                const peak = Math.max(...frames.map((frame) => frame.scale))
                expect(Math.abs(peak - 1.15), `${testId}: ${trace(frames)}`).toBeLessThan(0.01)
            } else {
                expect(
                    frames.every((frame) => Math.abs(frame.scale - 1) < 0.001),
                    `${testId}: ${trace(frames)}`
                ).toBe(true)
            }
            await page.mouse.move(0, 0)
        }

        for (const [testId] of cards) {
            await expect(page.getByTestId(testId)).toHaveAttribute('tabindex', '0')
        }
    })

    test('loads async feature bundles for m namespace components', async ({ page }) => {
        // The loader resolves `domAnimation` after 1.5 s.
        await page.goto('/tests/lazy-motion/async?@isPlaywright=true&delay=1500')

        const box = page.getByTestId('lazy-motion-async-box')
        await expect(box).toBeVisible()
        // (1) Prop-derived from `whileTap`, from the first render on.
        expect(await box.getAttribute('tabindex')).toBe('0')

        // (2) While the bundle loads the box has no VisualElement: it shows
        // `initial` (opacity 0) and ignores hover.
        await box.hover()
        const pending = await probeFrames(page, 'lazy-motion-async-box', 30)
        expect(
            pending.every(
                (frame) => Math.abs(frame.scale - 1) < 0.001 && Math.abs(frame.opacity) < 0.01
            ),
            trace(pending)
        ).toBe(true)

        // (3) Once it loads it animates in and hovers. `pointerenter` never
        // fires for a pointer that is already inside, so leave and re-enter.
        await expect
            .poll(() => box.evaluate((el) => Number(getComputedStyle(el).opacity)), {
                timeout: 5000
            })
            .toBeCloseTo(1, 2)
        // Each attempt leaves, re-enters and lets the 0.3 s hover run.
        await expect
            .poll(
                async () => {
                    await page.mouse.move(0, 0)
                    await box.hover()
                    await page.waitForTimeout(500)
                    return box.evaluate((el) => {
                        const transform = getComputedStyle(el).transform
                        return !transform || transform === 'none'
                            ? 1
                            : new DOMMatrixReadOnly(transform).a
                    })
                },
                { timeout: 8000 }
            )
            .toBeCloseTo(1.08, 2)
    })
})
