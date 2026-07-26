import { expect, test } from '@playwright/test'
import { beginHorizontalDrag } from '../_helpers/transform'

const URL = '/tests/drag/while-drag-transforms?@isPlaywright=true'

/**
 * Minimum recomposition samples the scripted drag must produce in the
 * measurement window below.
 *
 * Anti-vacuity floor, derived from the characterization baseline: the legacy
 * writer produced 30 changed-transform style mutations over 30 frames (one per
 * frame). Half of that is the floor, so a writer that stops repainting — or a
 * measurement that observes the wrong attribute and records nothing — FAILS
 * here instead of passing the per-frame budget with zero samples.
 */
const MIN_COMPOSES = 15

test.describe('drag/whileDrag write coalescing', () => {
    test('composes at most one transform write per frame while channel springs animate', async ({
        page
    }) => {
        await page.goto(URL)
        const card = page.getByTestId('perf-spring-card')
        await beginHorizontalDrag(page, card)

        try {
            // Pointer is now held still: every recomposition during the window
            // below is driven by the whileDrag channel springs, not pointermove.
            //
            // Measured on the `style` ATTRIBUTE, counting only mutations whose
            // `transform` declaration actually changed. That is the writer-agnostic
            // signal: whoever composes the transform (the drag writer or the
            // VisualElement) must set it on the element's inline style, while
            // idempotent re-writes of an unchanged string cost nothing and are
            // not recompositions.
            const metrics = await card.evaluate(
                (element) =>
                    new Promise<{
                        frames: number
                        composes: number
                        styleMutations: number
                        rotationDelta: number
                    }>((resolve) => {
                        const readTransformDeclaration = (style: string | null) => {
                            if (!style) return ''
                            const match = style.match(/(?:^|;)\s*transform\s*:\s*([^;]*)/)
                            return match ? match[1].trim() : ''
                        }

                        // `oldValue` per record; the NEW value of record `i` is
                        // record `i + 1`'s old value (no unobserved writes can
                        // slip between two consecutive records), and the live
                        // attribute closes the chain for the final record.
                        const oldValues: Array<string | null> = []
                        const observer = new MutationObserver((records) => {
                            for (const record of records) oldValues.push(record.oldValue)
                        })
                        observer.observe(element, {
                            attributes: true,
                            attributeFilter: ['style'],
                            attributeOldValue: true
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
                                for (const record of observer.takeRecords()) {
                                    oldValues.push(record.oldValue)
                                }
                                observer.disconnect()

                                const current = element.getAttribute('style')
                                let composes = 0
                                for (let index = 0; index < oldValues.length; index++) {
                                    const next =
                                        index + 1 < oldValues.length
                                            ? oldValues[index + 1]
                                            : current
                                    if (
                                        readTransformDeclaration(oldValues[index]) !==
                                        readTransformDeclaration(next)
                                    ) {
                                        composes++
                                    }
                                }

                                resolve({
                                    frames,
                                    composes,
                                    styleMutations: oldValues.length,
                                    rotationDelta: Math.abs(readRotation() - startRotation)
                                })
                                return
                            }
                            requestAnimationFrame(tick)
                        }
                        requestAnimationFrame(tick)
                    })
            )

            // Guard against a vacuous pass: the springs must still have been
            // animating during the measurement window.
            expect(
                metrics.rotationDelta,
                `rotation moved ${metrics.rotationDelta.toFixed(2)}deg during the window`
            ).toBeGreaterThan(1)

            // Guard against a vacuous pass a second way: the measurement itself
            // must have observed the transform being recomposed. Zero samples is
            // a broken measurement (or a dead writer), never a clean budget.
            expect(
                metrics.composes,
                `${metrics.composes} changed-transform mutations out of ${metrics.styleMutations} style mutations`
            ).toBeGreaterThanOrEqual(MIN_COMPOSES)

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
