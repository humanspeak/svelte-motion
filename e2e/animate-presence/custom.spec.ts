import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/animate-presence/custom?@isPlaywright=true'

async function scrollTestIdIntoView(page: Page, testId: string) {
    await page.evaluate((targetTestId) => {
        document
            .querySelector(`[data-testid="${targetTestId}"]`)
            ?.scrollIntoView({ block: 'center' })
    }, testId)
    await page.waitForTimeout(50)
}

async function scrollNestedPresenceDataViewport(page: Page) {
    await page.evaluate(() => {
        const viewport = document.querySelector<HTMLElement>(
            '[data-testid="presence-data-nested-scroll-viewport"]'
        )

        if (!viewport) throw new Error('Missing presence-data-nested-scroll-viewport')

        viewport.scrollTop = 180
    })
    await page.waitForTimeout(50)
}

async function waitForSettledSlide(page: Page, slide: string) {
    await page.waitForFunction(
        (expectedSlide) => {
            const el = document.querySelector<HTMLElement>('[data-testid="presence-custom-slide"]')
            if (!el || el.getAttribute('data-slide') !== expectedSlide) return false
            const style = getComputedStyle(el)
            return parseFloat(style.opacity) > 0.98 && style.transform !== ''
        },
        slide,
        { timeout: 5000 }
    )
}

async function waitForExitingCloneX(page: Page, direction: 'left' | 'right') {
    const threshold = direction === 'left' ? -20 : 20
    await page.waitForFunction(
        ({ threshold: expectedThreshold, direction: expectedDirection }) => {
            const clone = document.querySelector<HTMLElement>('[data-clone="true"]')
            if (!clone) return false
            const matrix = new DOMMatrixReadOnly(getComputedStyle(clone).transform)
            return expectedDirection === 'left'
                ? matrix.m41 < expectedThreshold
                : matrix.m41 > expectedThreshold
        },
        { threshold, direction },
        { timeout: 5000 }
    )
}

async function samplePresenceDataSquareLayers(
    page: Page,
    containerTestId = 'presence-data-container'
) {
    return page.evaluate(async (targetContainerTestId) => {
        const samples: Array<{
            count: number
            slides: string[]
            cloneCount: number
            totalOpacity: number
            rects: Array<{ x: number; width: number; opacity: number; clone: boolean }>
        }> = []

        const container = document.querySelector<HTMLElement>(
            `[data-testid="${targetContainerTestId}"]`
        )
        if (!container) throw new Error(`Missing ${targetContainerTestId}`)
        const containerRect = container.getBoundingClientRect()

        const getSample = () => {
            const elements = Array.from(
                document.querySelectorAll<HTMLElement>('[data-testid="presence-data-square"]')
            )
            const visible = elements
                .map((element) => {
                    const rect = element.getBoundingClientRect()
                    const style = getComputedStyle(element)
                    const opacity = Number.parseFloat(style.opacity || '1')
                    return {
                        element,
                        rect,
                        opacity,
                        clone: element.dataset.clone === 'true',
                        slide: element.dataset.slide ?? ''
                    }
                })
                .filter(
                    ({ rect, opacity }) =>
                        opacity > 0.05 &&
                        rect.right > containerRect.left &&
                        rect.left < containerRect.right &&
                        rect.bottom > containerRect.top &&
                        rect.top < containerRect.bottom &&
                        rect.width > 1
                )

            samples.push({
                count: visible.length,
                slides: visible.map(({ slide }) => slide),
                cloneCount: visible.filter(({ clone }) => clone).length,
                totalOpacity: Number(
                    visible.reduce((total, { opacity }) => total + opacity, 0).toFixed(3)
                ),
                rects: visible.map(({ rect, opacity, clone }) => ({
                    x: Math.round(rect.x),
                    width: Math.round(rect.width),
                    opacity: Number(opacity.toFixed(3)),
                    clone
                }))
            })
        }

        const start = performance.now()
        while (performance.now() - start < 750) {
            getSample()
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }

        return samples
    }, containerTestId)
}

async function clickAndSampleExitingPresenceDataSquare(
    page: Page,
    triggerTestId: string,
    durationMs = 300
) {
    return page.evaluate(
        async ({ sampleDurationMs, targetTriggerTestId }) => {
            const samples: Array<{ elapsed: number; x: number; opacity: number }> = []
            const trigger = document.querySelector<HTMLElement>(
                `[data-testid="${targetTriggerTestId}"]`
            )
            if (!trigger) throw new Error(`Missing ${targetTriggerTestId}`)

            const start = performance.now()
            trigger.click()

            while (performance.now() - start < sampleDurationMs) {
                const clone = document.querySelector<HTMLElement>(
                    '[data-testid="presence-data-square"][data-clone="true"]'
                )

                if (clone) {
                    const style = getComputedStyle(clone)
                    const matrix = new DOMMatrixReadOnly(style.transform)
                    samples.push({
                        elapsed: Math.round(performance.now() - start),
                        x: Number(matrix.m41.toFixed(2)),
                        opacity: Number(Number.parseFloat(style.opacity || '1').toFixed(3))
                    })
                }

                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            }

            return {
                minX: Math.min(...samples.map((sample) => sample.x), 0),
                maxX: Math.max(...samples.map((sample) => sample.x), 0),
                samples
            }
        },
        {
            sampleDurationMs: durationMs,
            targetTriggerTestId: triggerTestId
        }
    )
}

async function sampleIncomingPresenceDataSquare(
    page: Page,
    slide: string,
    durationMs = 180,
    containerTestId = 'presence-data-container'
) {
    return page.evaluate(
        async ({ expectedSlide, sampleDurationMs, targetContainerTestId }) => {
            const parseX = (transform: string) => {
                if (!transform || transform === 'none') return 0
                const values = transform
                    .match(/matrix\(([^)]+)\)/)?.[1]
                    ?.split(',')
                    .map((value) => Number.parseFloat(value.trim()))

                return values?.[4] ?? 0
            }

            const container = document.querySelector<HTMLElement>(
                `[data-testid="${targetContainerTestId}"]`
            )
            if (!container) throw new Error(`Missing ${targetContainerTestId}`)
            const containerRect = container.getBoundingClientRect()
            const samples: Array<{
                elapsed: number
                opacity: number
                x: number
                visibleCount: number
            }> = []
            const start = performance.now()

            while (performance.now() - start < sampleDurationMs) {
                const elements = Array.from(
                    document.querySelectorAll('[data-testid="presence-data-square"]')
                ).filter((element) => {
                    const rect = element.getBoundingClientRect()
                    return (
                        rect.right > containerRect.left &&
                        rect.left < containerRect.right &&
                        rect.bottom > containerRect.top &&
                        rect.top < containerRect.bottom
                    )
                }) as HTMLElement[]
                const incoming = elements.find(
                    (element) =>
                        element.dataset.slide === expectedSlide && element.dataset.clone !== 'true'
                )

                if (incoming) {
                    const style = getComputedStyle(incoming)
                    samples.push({
                        elapsed: Math.round(performance.now() - start),
                        opacity: Number(Number.parseFloat(style.opacity || '1').toFixed(3)),
                        x: Number(parseX(style.transform).toFixed(2)),
                        visibleCount: elements.filter((element) => {
                            const elementStyle = getComputedStyle(element)
                            const opacity = Number.parseFloat(elementStyle.opacity || '1')

                            return opacity > 0.05
                        }).length
                    })
                }

                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            }

            return {
                maxOpacity: Math.max(...samples.map((sample) => sample.opacity), 0),
                samples
            }
        },
        {
            expectedSlide: slide,
            sampleDurationMs: durationMs,
            targetContainerTestId: containerTestId
        }
    )
}

async function readSettledPresenceDataSquareBounds(
    page: Page,
    containerTestId = 'presence-data-container'
) {
    return page.evaluate((targetContainerTestId) => {
        const container = document.querySelector<HTMLElement>(
            `[data-testid="${targetContainerTestId}"]`
        )
        if (!container) throw new Error(`Missing ${targetContainerTestId}`)

        const containerRect = container.getBoundingClientRect()
        const squares = Array.from(
            document.querySelectorAll('[data-testid="presence-data-square"]')
        ).map((element) => {
            const el = element as HTMLElement
            const rect = el.getBoundingClientRect()
            const style = getComputedStyle(el)

            return {
                slide: el.dataset.slide,
                clone: el.dataset.clone === 'true',
                opacity: Number(Number.parseFloat(style.opacity || '1').toFixed(3)),
                rect: {
                    top: Math.round(rect.top),
                    right: Math.round(rect.right),
                    bottom: Math.round(rect.bottom),
                    left: Math.round(rect.left)
                },
                transform: style.transform
            }
        })
        const settled = squares.find(
            (square) =>
                square.opacity > 0.98 &&
                !square.clone &&
                square.rect.right > containerRect.left &&
                square.rect.left < containerRect.right &&
                square.rect.bottom > containerRect.top &&
                square.rect.top < containerRect.bottom
        )

        return {
            container: {
                top: Math.round(containerRect.top),
                right: Math.round(containerRect.right),
                bottom: Math.round(containerRect.bottom),
                left: Math.round(containerRect.left)
            },
            settled,
            squares
        }
    }, containerTestId)
}

async function clickAndSamplePresenceDataSquareOccupancy(
    page: Page,
    triggerTestId: string,
    containerTestId = 'presence-data-container',
    durationMs = 500
) {
    return page.evaluate(
        async ({ sampleDurationMs, targetContainerTestId, targetTriggerTestId }) => {
            const samples: Array<{
                elapsed: number
                visibleInsideCount: number
                visibleSquares: Array<{
                    slide: string | undefined
                    clone: boolean
                    opacity: number
                    rect: { top: number; bottom: number; left: number; right: number }
                }>
                container: { top: number; bottom: number; left: number; right: number }
            }> = []
            const container = document.querySelector<HTMLElement>(
                `[data-testid="${targetContainerTestId}"]`
            )
            if (!container) throw new Error(`Missing ${targetContainerTestId}`)
            const trigger = document.querySelector<HTMLElement>(
                `[data-testid="${targetTriggerTestId}"]`
            )
            if (!trigger) throw new Error(`Missing ${targetTriggerTestId}`)

            const start = performance.now()
            trigger.click()

            while (performance.now() - start < sampleDurationMs) {
                const containerRect = container.getBoundingClientRect()
                const visibleSquares = Array.from(
                    document.querySelectorAll('[data-testid="presence-data-square"]')
                )
                    .map((element) => {
                        const el = element as HTMLElement
                        const rect = el.getBoundingClientRect()
                        const style = getComputedStyle(el)
                        const opacity = Number(Number.parseFloat(style.opacity || '1').toFixed(3))

                        return {
                            slide: el.dataset.slide,
                            clone: el.dataset.clone === 'true',
                            opacity,
                            rect: {
                                top: Math.round(rect.top),
                                right: Math.round(rect.right),
                                bottom: Math.round(rect.bottom),
                                left: Math.round(rect.left)
                            }
                        }
                    })
                    .filter(
                        ({ opacity, rect }) =>
                            opacity > 0.05 &&
                            rect.right > containerRect.left &&
                            rect.left < containerRect.right &&
                            rect.bottom > containerRect.top &&
                            rect.top < containerRect.bottom
                    )

                samples.push({
                    elapsed: Math.round(performance.now() - start),
                    visibleInsideCount: visibleSquares.length,
                    visibleSquares,
                    container: {
                        top: Math.round(containerRect.top),
                        right: Math.round(containerRect.right),
                        bottom: Math.round(containerRect.bottom),
                        left: Math.round(containerRect.left)
                    }
                })

                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            }

            return samples
        },
        {
            sampleDurationMs: durationMs,
            targetContainerTestId: containerTestId,
            targetTriggerTestId: triggerTestId
        }
    )
}

async function clickAndSamplePresenceDataSquareVerticalAlignment(
    page: Page,
    triggerTestId: string,
    containerTestId: string,
    durationMs = 500
) {
    return page.evaluate(
        async ({ sampleDurationMs, targetContainerTestId, targetTriggerTestId }) => {
            const container = document.querySelector<HTMLElement>(
                `[data-testid="${targetContainerTestId}"]`
            )
            const trigger = document.querySelector<HTMLElement>(
                `[data-testid="${targetTriggerTestId}"]`
            )

            if (!container) throw new Error(`Missing ${targetContainerTestId}`)
            if (!trigger) throw new Error(`Missing ${targetTriggerTestId}`)

            const readButtonCenterY = () => {
                const buttons = Array.from(container.querySelectorAll<HTMLElement>('button'))
                const centers = buttons.map((button) => {
                    const rect = button.getBoundingClientRect()

                    return rect.top + rect.height / 2
                })

                return centers.reduce((total, center) => total + center, 0) / centers.length
            }
            const samples: Array<{
                elapsed: number
                maxDeltaY: number
                squares: Array<{ slide: string | undefined; clone: boolean; deltaY: number }>
            }> = []
            const start = performance.now()

            trigger.click()

            while (performance.now() - start < sampleDurationMs) {
                const containerRect = container.getBoundingClientRect()
                const buttonCenterY = readButtonCenterY()
                const squares = Array.from(
                    document.querySelectorAll('[data-testid="presence-data-square"]')
                )
                    .map((element) => {
                        const el = element as HTMLElement
                        const rect = el.getBoundingClientRect()
                        const style = getComputedStyle(el)
                        const opacity = Number.parseFloat(style.opacity || '1')
                        const centerY = rect.top + rect.height / 2

                        return {
                            slide: el.dataset.slide,
                            clone: el.dataset.clone === 'true',
                            opacity,
                            rect,
                            deltaY: Math.abs(centerY - buttonCenterY)
                        }
                    })
                    .filter(
                        ({ opacity, rect }) =>
                            opacity > 0.05 &&
                            rect.right > containerRect.left &&
                            rect.left < containerRect.right &&
                            rect.bottom > containerRect.top &&
                            rect.top < containerRect.bottom
                    )

                samples.push({
                    elapsed: Math.round(performance.now() - start),
                    maxDeltaY: Number(
                        Math.max(...squares.map((square) => square.deltaY), 0).toFixed(2)
                    ),
                    squares: squares.map(({ slide, clone, deltaY }) => ({
                        slide,
                        clone,
                        deltaY: Number(deltaY.toFixed(2))
                    }))
                })

                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            }

            return samples
        },
        {
            sampleDurationMs: durationMs,
            targetContainerTestId: containerTestId,
            targetTriggerTestId: triggerTestId
        }
    )
}

test.describe('AnimatePresence custom', () => {
    test('uses AnimatePresence custom for directional exit variants', async ({ page }) => {
        await page.goto(URL)
        await waitForSettledSlide(page, 'alpha')

        await page.getByTestId('next').click()
        await waitForExitingCloneX(page, 'left')
        await waitForSettledSlide(page, 'bravo')

        await page.getByTestId('previous').click()
        await waitForExitingCloneX(page, 'right')
        await waitForSettledSlide(page, 'alpha')
    })

    test('keeps the demo linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: 'AnimatePresence custom' })).toHaveAttribute(
            'href',
            /\/tests\/animate-presence\/custom/
        )
    })

    test('allows scrolling through all custom presence harness sections', async ({ page }) => {
        await page.goto(URL)
        await scrollTestIdIntoView(page, 'presence-data-motion-config-stage')

        const scrollY = await page.evaluate(() => window.scrollY)

        expect(scrollY).toBeGreaterThan(0)
        await expect(page.getByTestId('presence-data-motion-config-stage')).toBeVisible()
    })

    test('usePresenceData popLayout square keeps at most two visible layers during transition', async ({
        page
    }) => {
        await page.goto(URL)
        await expect(page.getByTestId('presence-data-pop-layout-stage')).toBeVisible()
        await scrollTestIdIntoView(page, 'presence-data-pop-layout-stage')

        await page.getByTestId('presence-data-next').click()
        const samples = await samplePresenceDataSquareLayers(page)
        const badSample = samples.find((sample) => sample.count > 2)

        expect(badSample, JSON.stringify(badSample, null, 2)).toBeUndefined()
    })

    test('usePresenceData popLayout square uses previous direction on first previous click', async ({
        page
    }) => {
        await page.goto(URL)
        await expect(page.getByTestId('presence-data-pop-layout-stage')).toBeVisible()
        await scrollTestIdIntoView(page, 'presence-data-pop-layout-stage')

        const report = await clickAndSampleExitingPresenceDataSquare(page, 'presence-data-previous')

        expect(report.samples.length, JSON.stringify(report, null, 2)).toBeGreaterThan(0)
        expect(report.maxX, JSON.stringify(report, null, 2)).toBeGreaterThan(20)
        expect(report.minX, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(-1)
    })

    test('usePresenceData popLayout square stays in its stage after scroll and click', async ({
        page
    }) => {
        await page.goto(URL)
        await expect(page.getByTestId('presence-data-pop-layout-stage')).toBeVisible()
        await scrollTestIdIntoView(page, 'presence-data-pop-layout-stage')

        const transitionSamples = await clickAndSamplePresenceDataSquareOccupancy(
            page,
            'presence-data-previous'
        )
        const emptyFrame = transitionSamples.find((sample) => sample.visibleInsideCount === 0)

        expect(emptyFrame, JSON.stringify(emptyFrame, null, 2)).toBeUndefined()
        await page.waitForTimeout(700)
        const report = await readSettledPresenceDataSquareBounds(page)

        expect(report.settled, JSON.stringify(report, null, 2)).toBeDefined()
        expect(report.settled!.rect.top, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
            report.container.top
        )
        expect(report.settled!.rect.bottom, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
            report.container.bottom
        )
    })

    test('usePresenceData popLayout square holds incoming slide during interrupted delayed enter', async ({
        page
    }) => {
        await page.goto(URL)
        await expect(page.getByTestId('presence-data-pop-layout-stage')).toBeVisible()
        await scrollTestIdIntoView(page, 'presence-data-pop-layout-stage')

        await page.getByTestId('presence-data-next').click()
        await page.waitForTimeout(250)
        await page.getByTestId('presence-data-next').click()
        const report = await sampleIncomingPresenceDataSquare(page, '3')

        expect(report.samples.length, JSON.stringify(report, null, 2)).toBeGreaterThan(0)
        expect(report.maxOpacity, JSON.stringify(report, null, 2)).toBeLessThan(0.2)
    })

    test('usePresenceData demo can isolate itself from parent MotionConfig defaults', async ({
        page
    }) => {
        await page.goto(URL)
        await expect(page.getByTestId('presence-data-motion-config-stage')).toBeVisible()
        await scrollTestIdIntoView(page, 'presence-data-motion-config-stage')

        await page.getByTestId('presence-data-isolated-next').click()
        const samples = await samplePresenceDataSquareLayers(
            page,
            'presence-data-isolated-container'
        )
        const maxCombinedOpacity = Math.max(...samples.map((sample) => sample.totalOpacity))
        const badSample = samples.find((sample) => sample.totalOpacity > 1.05)

        expect(maxCombinedOpacity, JSON.stringify(samples, null, 2)).toBeGreaterThan(0.25)
        expect(badSample, JSON.stringify(badSample, null, 2)).toBeUndefined()
    })

    test('usePresenceData popLayout square stays in a nested scroll viewport after scroll and click', async ({
        page
    }) => {
        await page.goto(URL)
        await expect(page.getByTestId('presence-data-nested-scroll-stage')).toBeVisible()
        await scrollTestIdIntoView(page, 'presence-data-nested-scroll-stage')
        await scrollNestedPresenceDataViewport(page)

        const transitionSamples = await clickAndSamplePresenceDataSquareOccupancy(
            page,
            'presence-data-nested-scroll-next',
            'presence-data-nested-scroll-viewport'
        )
        const alignmentSamples = await clickAndSamplePresenceDataSquareVerticalAlignment(
            page,
            'presence-data-nested-scroll-previous',
            'presence-data-nested-scroll-viewport'
        )
        const emptyFrame = transitionSamples.find((sample) => sample.visibleInsideCount === 0)
        const misalignedFrame = alignmentSamples.find((sample) => sample.maxDeltaY > 4)

        expect(emptyFrame, JSON.stringify(emptyFrame, null, 2)).toBeUndefined()
        expect(misalignedFrame, JSON.stringify(misalignedFrame, null, 2)).toBeUndefined()
        await page.waitForTimeout(700)
        const report = await readSettledPresenceDataSquareBounds(
            page,
            'presence-data-nested-scroll-viewport'
        )

        expect(report.settled, JSON.stringify(report, null, 2)).toBeDefined()
        expect(report.settled!.rect.top, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
            report.container.top
        )
        expect(report.settled!.rect.bottom, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
            report.container.bottom
        )
    })
})
