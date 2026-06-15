import { expect, test } from '@playwright/test'

test.describe('useAnimationControls', () => {
    const gotoReady = async (page: import('@playwright/test').Page) => {
        await page.goto('/tests/animation-controls')
        await expect(page.getByTestId('stage')).toHaveAttribute('data-hydrated', 'true')
    }

    const readCardState = async (page: import('@playwright/test').Page) =>
        page.getByTestId('card').evaluate((el) => {
            const style = getComputedStyle(el)
            const matrix =
                style.transform === 'none'
                    ? new DOMMatrixReadOnly()
                    : new DOMMatrixReadOnly(style.transform)
            return {
                text: el.textContent ?? '',
                transform: style.transform,
                x: matrix.m41
            }
        })

    test('starts coordinated subscribers and completes the sequence', async ({ page }) => {
        await gotoReady(page)

        await expect(page.getByTestId('label')).toHaveText('idle')

        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })
        await expect(page.getByTestId('run-count')).toHaveText('runs: 1')

        const cardTransform = await page
            .getByTestId('card')
            .evaluate((el) => getComputedStyle(el).transform)
        expect(cardTransform === 'none' || cardTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
    })

    test('does not flash back to rest between chained controls animations', async ({ page }) => {
        await gotoReady(page)

        const framesPromise = page.evaluate(
            async () =>
                await new Promise<Array<{ x: number; label: string }>>((resolve) => {
                    const card = document.querySelector<HTMLElement>('[data-testid="card"]')
                    const frames: Array<{ x: number; label: string }> = []
                    const label = document.querySelector<HTMLElement>('[data-testid="label"]')
                    const started = performance.now()

                    const readX = () => {
                        if (!card) return 0
                        const style = getComputedStyle(card)
                        const matrix =
                            style.transform === 'none'
                                ? new DOMMatrixReadOnly()
                                : new DOMMatrixReadOnly(style.transform)
                        return matrix.m41
                    }

                    const tick = () => {
                        frames.push({
                            x: readX(),
                            label: label?.textContent ?? ''
                        })

                        if (performance.now() - started < 1200) {
                            requestAnimationFrame(tick)
                        } else {
                            resolve(frames)
                        }
                    }

                    requestAnimationFrame(tick)
                })
        )

        await page.getByTestId('start').click()
        const confirmingFrames = await framesPromise

        const xFrames = confirmingFrames.map((frame) => frame.x)
        const peak = Math.max(...xFrames)
        const peakIndex = xFrames.findIndex((x) => x === peak)
        const afterPeak = xFrames.slice(peakIndex)

        expect(peak).toBeGreaterThan(50)
        expect(Math.min(...afterPeak.slice(-10))).toBeLessThan(5)

        for (let i = 0; i < afterPeak.length - 1; i += 1) {
            if (afterPeak[i] >= 20) continue
            const laterMax = Math.max(...afterPeak.slice(i + 1))
            expect(laterMax).toBeLessThan(30)
        }
    })

    test('set jumps subscribers to their final variant state', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('set').click()
        await expect(page.getByTestId('label')).toHaveText('complete')
        await expect(page.getByTestId('run-count')).toHaveText('runs: 1')
    })

    test('reset returns subscribers to idle after a run', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })

        await page.getByTestId('reset').click()
        await expect(page.getByTestId('label')).toHaveText('idle')
    })

    test('initial variant remains stable before controls run', async ({ page }) => {
        await gotoReady(page)

        await page.waitForTimeout(500)

        const orb = await page.getByTestId('orb').evaluate((el) => {
            const style = getComputedStyle(el)
            const matrix =
                style.transform === 'none'
                    ? new DOMMatrixReadOnly()
                    : new DOMMatrixReadOnly(style.transform)

            return {
                opacity: Number(style.opacity),
                scaleX: matrix.a,
                scaleY: matrix.d
            }
        })

        expect(orb.opacity).toBeCloseTo(0.45, 2)
        expect(orb.scaleX).toBeCloseTo(0.9, 2)
        expect(orb.scaleY).toBeCloseTo(0.9, 2)
    })

    test('stop freezes active subscribers mid-sequence', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('start').click()
        await expect
            .poll(async () => (await readCardState(page)).x, { timeout: 3000 })
            .toBeGreaterThan(5)

        await page.getByTestId('stop').click()
        await expect(page.getByTestId('label')).toHaveText('stopped')

        const stopped = await readCardState(page)
        await page.waitForTimeout(900)
        const later = await readCardState(page)

        expect(later.text).toContain('stopped')
        expect(Math.abs(later.x - stopped.x)).toBeLessThan(2)
    })
})
