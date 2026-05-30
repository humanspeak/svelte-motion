import { expect, test } from '@playwright/test'

test.describe('Enter Animation', () => {
    test('should animate from invisible to visible', async ({ page }) => {
        await page.addInitScript(() => {
            const frames: Array<{ opacity: number; scale: number }> = []
            ;(window as unknown as { __enterFrames: typeof frames }).__enterFrames = frames
            const readFrame = () => {
                const element = document.querySelector('[data-testid="motion-div"]')
                if (element) {
                    const style = getComputedStyle(element)
                    const transform = style.transform
                    const matrix = transform.match(/matrix\(([^)]+)\)/)
                    frames.push({
                        opacity: Number(style.opacity),
                        scale: matrix
                            ? Number.parseFloat(matrix[1].split(',')[0])
                            : transform === 'none'
                              ? 1
                              : 0
                    })
                }
                if (frames.length < 80) requestAnimationFrame(readFrame)
            }
            requestAnimationFrame(readFrame)
        })

        // Navigate with query param
        await page.goto('/tests/motion/enter-animation?slow&@isPlaywright=true')

        // Wait specifically for the element to appear with initial state
        const element = page.getByTestId('motion-div')

        // Optimized appear is the expected SSR enter path when available.
        await expect(element).toHaveAttribute('data-path', '6')
        await expect(element).toHaveAttribute('data-playwright', 'true')

        await expect
            .poll(
                async () => {
                    const frames = await page.evaluate(
                        () =>
                            (
                                window as unknown as {
                                    __enterFrames?: Array<{ opacity: number; scale: number }>
                                }
                            ).__enterFrames ?? []
                    )
                    return frames.some(
                        (frame) =>
                            frame.opacity > 0.05 &&
                            frame.opacity < 0.95 &&
                            frame.scale > 0.05 &&
                            frame.scale < 0.95
                    )
                },
                { timeout: 2000, message: 'never observed an intermediate enter frame' }
            )
            .toBe(true)

        const firstFrame = await page.evaluate(() => {
            const frames =
                (
                    window as unknown as {
                        __enterFrames?: Array<{ opacity: number; scale: number }>
                    }
                ).__enterFrames ?? []
            return frames.find((frame) => Number.isFinite(frame.opacity))
        })

        expect(firstFrame?.opacity).toBeLessThanOrEqual(0.3)
        expect(firstFrame?.scale).toBeLessThanOrEqual(0.3)

        // Wait and verify final state (CSS-driven)
        await expect(element).toHaveAttribute('data-is-loaded', 'ready')
        await expect(element).toHaveCSS('opacity', '1')
        await expect(element).toHaveCSS('background-color', 'rgb(255, 0, 0)')
        await expect(element).toHaveCSS('border-radius', '50%')
    })
})
