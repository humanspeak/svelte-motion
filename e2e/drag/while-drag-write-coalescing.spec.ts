import { expect, test } from '@playwright/test'
import { beginHorizontalDrag } from '../_helpers/transform'

const URL = '/tests/drag/while-drag-transforms?@isPlaywright=true'

test.describe('drag/whileDrag write coalescing', () => {
    test('composes at most one transform write per frame while channel springs animate', async ({
        page
    }) => {
        await page.goto(URL)
        const card = page.getByTestId('perf-spring-card')
        await beginHorizontalDrag(page, card)

        try {
            // Pointer is now held still: every composer write during the window
            // below is driven by the whileDrag channel springs, not pointermove.
            // Each full recomposition writes data-svelte-motion-drag-transform,
            // so attribute mutations count composes exactly.
            const metrics = await card.evaluate(
                (element) =>
                    new Promise<{ frames: number; composes: number; rotationDelta: number }>(
                        (resolve) => {
                            let composes = 0
                            const observer = new MutationObserver((records) => {
                                composes += records.length
                            })
                            observer.observe(element, {
                                attributes: true,
                                attributeFilter: ['data-svelte-motion-drag-transform']
                            })

                            const readRotation = () => {
                                const matrix = new DOMMatrixReadOnly(
                                    getComputedStyle(element).transform
                                )
                                return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
                            }
                            const startRotation = readRotation()

                            let frames = 0
                            const tick = () => {
                                frames++
                                if (frames >= 30) {
                                    composes += observer.takeRecords().length
                                    observer.disconnect()
                                    resolve({
                                        frames,
                                        composes,
                                        rotationDelta: Math.abs(readRotation() - startRotation)
                                    })
                                    return
                                }
                                requestAnimationFrame(tick)
                            }
                            requestAnimationFrame(tick)
                        }
                    )
            )

            // Guard against a vacuous pass: the springs must still have been
            // animating during the measurement window.
            expect(
                metrics.rotationDelta,
                `rotation moved ${metrics.rotationDelta.toFixed(2)}deg during the window`
            ).toBeGreaterThan(1)

            // Two animated channels (rotate, scale) must not each drive a full
            // recomposition: one composed write per frame is enough. The 1.25
            // budget tolerates scheduling jitter, not per-channel duplication.
            const composesPerFrame = metrics.composes / metrics.frames
            expect(
                composesPerFrame,
                `${metrics.composes} composes over ${metrics.frames} frames = ${composesPerFrame.toFixed(2)} per frame`
            ).toBeLessThanOrEqual(1.25)
        } finally {
            await page.mouse.up()
        }
    })
})
