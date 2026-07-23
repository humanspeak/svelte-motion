import { expect, test } from '@playwright/test'
import { sampleTransformSeries } from '../_helpers/transform'

type ButtonSample = {
    buttonText: string
    hiddenWaitStates: number
    labelClassName: string
    buttonFontSize: string
    buttonLineHeight: string
    buttonColor: string
    buttonBackgroundColor: string
    buttonBorderColor: string
    buttonAppearance: string
    buttonOverflow: string
    buttonTransform: string
    labelFontSize: string
    labelLineHeight: string
    labelColor: string
    labelOpacity: string
    labelOverflow: string
    labelTransform: string
    labelWidth: number
    labelHeight: number
}

type ButtonBox = {
    documentTop: number
    height: number
    text: string
    width: number
}

type ShellBox = {
    centerX: number
    centerY: number
    top: number
}

const sampleButtonBox = async (
    page: import('@playwright/test').Page,
    testIdPrefix: string
): Promise<ButtonBox> =>
    page.getByTestId(`${testIdPrefix}-button`).evaluate((button) => {
        const rect = button.getBoundingClientRect()
        return {
            documentTop: rect.top + window.scrollY,
            height: rect.height,
            text: button.textContent?.trim() ?? '',
            width: rect.width
        }
    })

const sampleRollingShellBox = async (page: import('@playwright/test').Page): Promise<ShellBox> =>
    page.getByTestId('rolling-button').evaluate((button) => {
        const rect = button.getBoundingClientRect()
        return {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            top: rect.top
        }
    })

const parseScaleX = (transform: string): number => {
    if (!transform || transform === 'none') return 1
    const matrix = transform.match(/^matrix\(([^)]+)\)$/)
    if (!matrix) return 1
    const [a] = matrix[1].split(',').map((value) => Number.parseFloat(value.trim()))
    return Number.isFinite(a) ? a : 1
}

const sampleButton = async (
    page: import('@playwright/test').Page,
    testIdPrefix: string
): Promise<ButtonSample> =>
    page.getByTestId(`${testIdPrefix}-button`).evaluate((button) => {
        const buttonElement = button as HTMLButtonElement
        const labelElement = Array.from(buttonElement.querySelectorAll<HTMLElement>('.state')).find(
            (state) => {
                const style = getComputedStyle(state)
                const rect = state.getBoundingClientRect()
                return (
                    style.display !== 'none' &&
                    state.getAttribute('data-presence-wait-hidden') !== 'true' &&
                    !state.closest('[data-clone="true"]') &&
                    rect.width > 0 &&
                    rect.height > 0
                )
            }
        )
        if (!labelElement) throw new Error('missing label state')

        const buttonStyle = getComputedStyle(buttonElement)
        const labelStyle = getComputedStyle(labelElement)
        const labelRect = labelElement.getBoundingClientRect()

        return {
            buttonText: buttonElement.textContent?.trim() ?? '',
            hiddenWaitStates: buttonElement.querySelectorAll('[data-presence-wait-hidden="true"]')
                .length,
            labelClassName: labelElement.className,
            buttonFontSize: buttonStyle.fontSize,
            buttonLineHeight: buttonStyle.lineHeight,
            buttonColor: buttonStyle.color,
            buttonBackgroundColor: buttonStyle.backgroundColor,
            buttonBorderColor: buttonStyle.borderColor,
            buttonAppearance: buttonStyle.appearance,
            buttonOverflow: buttonStyle.overflow,
            buttonTransform: buttonStyle.transform,
            labelFontSize: labelStyle.fontSize,
            labelLineHeight: labelStyle.lineHeight,
            labelColor: labelStyle.color,
            labelOpacity: labelStyle.opacity,
            labelOverflow: labelStyle.overflow,
            labelTransform: labelStyle.transform,
            labelWidth: labelRect.width,
            labelHeight: labelRect.height
        }
    })

const waitForProjectedLayoutSettled = async (
    page: import('@playwright/test').Page,
    testIdPrefix: string
) =>
    page.waitForFunction((prefix) => {
        const buttonElement = document.querySelector<HTMLElement>(
            `[data-testid="${prefix}-button"]`
        )
        if (!buttonElement) return false

        const visibleState = Array.from(buttonElement.querySelectorAll<HTMLElement>('.state')).find(
            (state) => {
                const style = getComputedStyle(state)
                const rect = state.getBoundingClientRect()
                return (
                    style.display !== 'none' &&
                    state.getAttribute('data-presence-wait-hidden') !== 'true' &&
                    !state.closest('[data-clone="true"]') &&
                    rect.width > 0 &&
                    rect.height > 0
                )
            }
        )
        const buttonStyle = getComputedStyle(buttonElement)
        const stateStyle = visibleState ? getComputedStyle(visibleState) : undefined

        return (
            buttonElement.style.width === '' &&
            buttonElement.style.height === '' &&
            buttonStyle.transform === 'none' &&
            (!visibleState || stateStyle?.transform === 'none')
        )
    }, testIdPrefix)

const collectSamples = async (
    page: import('@playwright/test').Page,
    testIdPrefix: string,
    durationMs: number
): Promise<ButtonSample[]> =>
    page.evaluate(
        async ({ duration, prefix }) => {
            const samples: ButtonSample[] = []
            const started = performance.now()

            const read = () => {
                const buttonElement = document.querySelector<HTMLButtonElement>(
                    `[data-testid="${prefix}-button"]`
                )
                const labelElement =
                    buttonElement &&
                    Array.from(buttonElement.querySelectorAll<HTMLElement>('.state')).find(
                        (state) => {
                            const style = getComputedStyle(state)
                            const rect = state.getBoundingClientRect()
                            return (
                                style.display !== 'none' &&
                                state.getAttribute('data-presence-wait-hidden') !== 'true' &&
                                !state.closest('[data-clone="true"]') &&
                                rect.width > 0 &&
                                rect.height > 0
                            )
                        }
                    )
                if (!buttonElement || !labelElement) return

                const buttonStyle = getComputedStyle(buttonElement)
                const labelStyle = getComputedStyle(labelElement)
                const labelRect = labelElement.getBoundingClientRect()
                samples.push({
                    buttonText: buttonElement.textContent?.trim() ?? '',
                    hiddenWaitStates: buttonElement.querySelectorAll(
                        '[data-presence-wait-hidden="true"]'
                    ).length,
                    labelClassName: labelElement.className,
                    buttonFontSize: buttonStyle.fontSize,
                    buttonLineHeight: buttonStyle.lineHeight,
                    buttonColor: buttonStyle.color,
                    buttonBackgroundColor: buttonStyle.backgroundColor,
                    buttonBorderColor: buttonStyle.borderColor,
                    buttonAppearance: buttonStyle.appearance,
                    buttonOverflow: buttonStyle.overflow,
                    buttonTransform: buttonStyle.transform,
                    labelFontSize: labelStyle.fontSize,
                    labelLineHeight: labelStyle.lineHeight,
                    labelColor: labelStyle.color,
                    labelOpacity: labelStyle.opacity,
                    labelOverflow: labelStyle.overflow,
                    labelTransform: labelStyle.transform,
                    labelWidth: labelRect.width,
                    labelHeight: labelRect.height
                })
            }

            return new Promise<ButtonSample[]>((resolve) => {
                const frame = () => {
                    read()
                    if (performance.now() - started < duration) {
                        requestAnimationFrame(frame)
                    } else {
                        resolve(samples)
                    }
                }
                requestAnimationFrame(frame)
            })
        },
        { duration: durationMs, prefix: testIdPrefix }
    )

const expectReadyCopyState = async (
    page: import('@playwright/test').Page,
    testIdPrefix: string
) => {
    const copyState = page.getByTestId(`${testIdPrefix}-copy-state`)
    await expect(copyState).toBeVisible({ timeout: 3000 })
    await expect(copyState).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
    await expect(copyState).not.toHaveAttribute('data-presence-wait-hidden', 'true', {
        timeout: 3000
    })
}

const expectReadableRollingState = async (
    page: import('@playwright/test').Page,
    state: 'copy' | 'copied'
) => {
    await expect
        .poll(
            async () =>
                page.getByTestId('rolling-button').evaluate((button, expectedState) => {
                    const buttonRect = button.getBoundingClientRect()
                    const stateElement = button.querySelector<HTMLElement>(
                        `[data-testid="rolling-${expectedState}-state"]`
                    )
                    if (!stateElement) return undefined

                    const stateRect = stateElement.getBoundingClientRect()
                    const stateStyle = getComputedStyle(stateElement)

                    const sample = {
                        opacity: Number.parseFloat(stateStyle.opacity),
                        filter: stateStyle.filter,
                        text: stateElement.textContent?.trim() ?? '',
                        contained:
                            stateRect.left >= buttonRect.left - 4 &&
                            stateRect.right <= buttonRect.right + 4 &&
                            stateRect.top >= buttonRect.top - 4 &&
                            stateRect.bottom <= buttonRect.bottom + 4
                    }

                    return (
                        sample.text.includes(expectedState) &&
                        sample.opacity >= 0.99 &&
                        sample.filter === 'blur(0px)' &&
                        sample.contained
                    )
                }, state),
            { message: `${state} should settle into a readable state`, timeout: 2200 }
        )
        .toBe(true)
}

const expectRollingShellAnchored = async (
    page: import('@playwright/test').Page,
    baseline: ShellBox,
    label: string
) => {
    await expect
        .poll(
            async () => {
                const current = await sampleRollingShellBox(page)
                return (
                    Math.abs(current.centerX - baseline.centerX) <= 1 &&
                    Math.abs(current.centerY - baseline.centerY) <= 1 &&
                    Math.abs(current.top - baseline.top) <= 1
                )
            },
            { message: `${label} should not move the rolling button shell`, timeout: 1200 }
        )
        .toBe(true)
}

test.describe('AnimatePresence layout button dogfood', () => {
    test('keeps docs-kit copy feedback inside the fixed button shell', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('docs-kit-copy-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveAttribute('data-stage', 'copy')
        await expect(button).toContainText('copy')

        const samples = await page.evaluate(async () => {
            const samples: Array<{
                phase: 'click' | 'reset'
                buttonRect: { left: number; right: number; top: number; bottom: number }
                visibleStates: Array<{
                    text: string
                    opacity: number
                    rect: { left: number; right: number; top: number; bottom: number }
                    transform: string
                }>
            }> = []
            const buttonElement = document.querySelector<HTMLElement>(
                '[data-testid="docs-kit-copy-button"]'
            )
            if (!buttonElement) throw new Error('missing docs-kit copy button')

            const collect = async (phase: 'click' | 'reset', duration: number) =>
                await new Promise<void>((resolve) => {
                    const started = performance.now()
                    const frame = () => {
                        const buttonRect = buttonElement.getBoundingClientRect()
                        const visibleStates = Array.from(
                            buttonElement.querySelectorAll<HTMLElement>('.docs-kit-copy-state')
                        )
                            .map((state) => {
                                const rect = state.getBoundingClientRect()
                                const style = getComputedStyle(state)
                                return {
                                    text: state.textContent?.trim() ?? '',
                                    opacity: Number.parseFloat(style.opacity),
                                    rect: {
                                        left: rect.left,
                                        right: rect.right,
                                        top: rect.top,
                                        bottom: rect.bottom
                                    },
                                    transform: style.transform
                                }
                            })
                            .filter(
                                (state) =>
                                    state.opacity > 0.08 &&
                                    state.rect.right > state.rect.left &&
                                    state.rect.bottom > state.rect.top
                            )

                        samples.push({
                            phase,
                            buttonRect: {
                                left: buttonRect.left,
                                right: buttonRect.right,
                                top: buttonRect.top,
                                bottom: buttonRect.bottom
                            },
                            visibleStates
                        })

                        if (performance.now() - started < duration) requestAnimationFrame(frame)
                        else resolve()
                    }
                    requestAnimationFrame(frame)
                })

            buttonElement.click()
            await collect('click', 450)
            await new Promise<void>((resolve) => {
                const started = performance.now()
                const frame = () => {
                    if (
                        buttonElement.getAttribute('data-stage') !== 'copy' &&
                        performance.now() - started < 2600
                    ) {
                        requestAnimationFrame(frame)
                    } else resolve()
                }
                requestAnimationFrame(frame)
            })
            await collect('reset', 450)

            return samples
        })

        const clickSamples = samples.filter((sample) => sample.phase === 'click')
        const resetSamples = samples.filter((sample) => sample.phase === 'reset')
        expect(clickSamples.length).toBeGreaterThan(8)
        expect(resetSamples.length).toBeGreaterThan(8)

        for (const sample of samples) {
            const visibleOpacity = sample.visibleStates.reduce(
                (total, state) => total + state.opacity,
                0
            )
            expect(visibleOpacity, `${sample.phase} visible opacity`).toBeGreaterThan(0.35)

            for (const state of sample.visibleStates) {
                expect(state.rect.left, sample.phase).toBeGreaterThanOrEqual(
                    sample.buttonRect.left - 1
                )
                expect(state.rect.right, sample.phase).toBeLessThanOrEqual(
                    sample.buttonRect.right + 1
                )
                expect(state.rect.top, sample.phase).toBeGreaterThanOrEqual(
                    sample.buttonRect.top - 1
                )
                expect(state.rect.bottom, sample.phase).toBeLessThanOrEqual(
                    sample.buttonRect.bottom + 1
                )
                expect(parseScaleX(state.transform), sample.phase).toBeCloseTo(1, 3)
            }
        }

        await expect(button).toHaveAttribute('data-stage', 'copy')
        await expect(button).toContainText('copy')
    })

    test('runs the interactive rolling copy control', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('rolling-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveAttribute('data-stage', 'copy')
        await expectReadableRollingState(page, 'copy')

        const copyWidth = await button.evaluate((element) => element.getBoundingClientRect().width)
        const baselineShell = await sampleRollingShellBox(page)

        await button.hover()
        await expectRollingShellAnchored(page, baselineShell, 'hover')
        await button.click()
        await expect(button).toHaveAttribute('data-stage', 'copied', { timeout: 1200 })
        await expect(page.getByTestId('rolling-copied-state')).toBeVisible()
        await expectReadableRollingState(page, 'copied')
        await expectRollingShellAnchored(page, baselineShell, 'click')

        await expect
            .poll(
                async () =>
                    button.evaluate((element) => {
                        const rect = element.getBoundingClientRect()
                        return rect.width
                    }),
                { message: 'copied state should grow the shell wider than copy', timeout: 1200 }
            )
            .toBeGreaterThan(copyWidth + 4)

        await expect(button).toHaveAttribute('data-stage', 'copy', { timeout: 3000 })
        await expect(page.getByTestId('rolling-copy-state')).toBeVisible()
        await expectReadableRollingState(page, 'copy')
        await expectRollingShellAnchored(page, baselineShell, 'reset')
    })

    test('keeps rolling copy labels out of scaled ancestors during the swap', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('rolling-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveAttribute('data-stage', 'copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadableRollingState(page, 'copy')

        await button.hover()
        await button.click()
        await expect(button).toHaveAttribute('data-stage', 'copied', { timeout: 1200 })

        const samples = await page.evaluate(async () => {
            type RollingScaleSample = {
                contentScale: number
                effectiveScale: number
                labelOpacity: number
                labelScale: number
                labelText: string
            }

            const parseScaleX = (transform: string): number => {
                if (!transform || transform === 'none') return 1
                const matrix = transform.match(/^matrix\(([^)]+)\)$/)
                if (!matrix) return 1
                const [a] = matrix[1].split(',').map((value) => Number.parseFloat(value.trim()))
                return Number.isFinite(a) ? a : 1
            }

            const effectiveScaleX = (element: HTMLElement, stopAt: HTMLElement): number => {
                let scale = 1
                let current: HTMLElement | null = element
                while (current) {
                    scale *= parseScaleX(getComputedStyle(current).transform)
                    if (current === stopAt) break
                    current = current.parentElement
                }
                return scale
            }

            const buttonElement = document.querySelector<HTMLElement>(
                '[data-testid="rolling-button"]'
            )
            const contentElement = document.querySelector<HTMLElement>(
                '[data-testid="rolling-button-content"]'
            )
            if (!buttonElement || !contentElement) throw new Error('missing rolling button')

            const samples: RollingScaleSample[] = []
            const started = performance.now()

            return await new Promise<RollingScaleSample[]>((resolve) => {
                const frame = () => {
                    const contentScale = parseScaleX(getComputedStyle(contentElement).transform)

                    for (const labelElement of buttonElement.querySelectorAll<HTMLElement>(
                        '.rolling-state'
                    )) {
                        const labelStyle = getComputedStyle(labelElement)
                        const labelRect = labelElement.getBoundingClientRect()
                        const labelOpacity = Number.parseFloat(labelStyle.opacity)
                        if (labelRect.width <= 0 || labelRect.height <= 0 || labelOpacity <= 0.05) {
                            continue
                        }

                        const labelScale = parseScaleX(labelStyle.transform)
                        samples.push({
                            contentScale,
                            effectiveScale: effectiveScaleX(labelElement, buttonElement),
                            labelOpacity,
                            labelScale,
                            labelText: labelElement.textContent?.trim() ?? ''
                        })
                    }

                    if (performance.now() - started < 900) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        const visibleSamples = samples.filter((sample) => sample.labelOpacity > 0.2)
        expect(visibleSamples.length).toBeGreaterThan(5)

        const scaledSamples = visibleSamples.filter(
            (sample) => Math.abs(sample.effectiveScale - 1) > 0.001
        )
        expect(
            scaledSamples.slice(0, 5),
            `scaled rolling label samples: ${JSON.stringify(scaledSamples.slice(0, 5))}`
        ).toEqual([])
    })

    test('renders status icons as SVG instead of font glyphs', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expectReadyCopyState(page, 'wait')

        await expect(button.locator('svg[data-testid="wait-copy-icon"]')).toBeVisible()
        expect(
            await button
                .locator('svg[data-testid="wait-copy-icon"]')
                .evaluate((icon) => icon.textContent)
        ).toBe('')

        await button.click()
        await expect(page.getByTestId('wait-copied-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 2500 }
        )
        await expect(button).toHaveText('copied')
        await expect(button.locator('svg[data-testid="wait-copied-icon"]')).toBeVisible()
        expect(
            await button
                .locator('svg[data-testid="wait-copied-icon"]')
                .evaluate((icon) => icon.textContent)
        ).toBe('')
    })

    test('keeps interactive paint metrics on whole pixels', async ({ page }) => {
        const prefixes = ['wait', 'sync', 'pop-layout']

        for (const prefix of prefixes) {
            await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

            const button = page.getByTestId(`${prefix}-button`)
            await expect(button).toBeVisible()
            await expect(button).toHaveText('copy')
            await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
            await expectReadyCopyState(page, prefix)

            const readMetrics = async (label: string) =>
                button.evaluate((buttonElement, snapshotLabel) => {
                    const stateElement =
                        Array.from(buttonElement.querySelectorAll<HTMLElement>('.state')).find(
                            (state) => {
                                const style = getComputedStyle(state)
                                const rect = state.getBoundingClientRect()
                                return (
                                    style.display !== 'none' &&
                                    state.getAttribute('data-presence-wait-hidden') !== 'true' &&
                                    !state.closest('[data-clone="true"]') &&
                                    rect.width > 0 &&
                                    rect.height > 0
                                )
                            }
                        ) ??
                        buttonElement.querySelector<HTMLElement>(
                            '.state:not([data-presence-wait-hidden="true"])'
                        )
                    if (!stateElement) throw new Error('missing visible state')

                    const buttonStyle = getComputedStyle(buttonElement)
                    const stateStyle = getComputedStyle(stateElement)
                    const buttonRect = buttonElement.getBoundingClientRect()
                    const stateRect = stateElement.getBoundingClientRect()

                    return {
                        label: snapshotLabel,
                        buttonHeight: buttonRect.height,
                        buttonLineHeight: Number.parseFloat(buttonStyle.lineHeight),
                        stateHeight: stateRect.height,
                        stateLineHeight: Number.parseFloat(stateStyle.lineHeight),
                        stateText: stateElement.textContent?.trim() ?? ''
                    }
                }, label)

            const samples = [await readMetrics('idle')]
            expect(await sampleButton(page, prefix)).toMatchObject({
                buttonAppearance: 'none'
            })

            await button.hover()
            await button.focus()
            samples.push(await readMetrics('hover-focus'))

            await button.click()
            await expect(page.getByTestId(`${prefix}-copied-state`)).toBeVisible({
                timeout: 3000
            })
            await waitForProjectedLayoutSettled(page, prefix)
            samples.push(await readMetrics('copied-settled'))

            const resetTimeout = prefix === 'wait' ? 6200 : 4200
            await expect(button).toHaveText('copy', { timeout: resetTimeout })
            await expect(page.getByTestId(`${prefix}-copy-state`)).toBeVisible({
                timeout: 3000
            })
            await waitForProjectedLayoutSettled(page, prefix)
            samples.push(await readMetrics('reset-settled'))

            for (const sample of samples) {
                for (const [metric, value] of Object.entries(sample)) {
                    if (typeof value !== 'number') continue

                    expect(
                        Math.abs(value - Math.round(value)),
                        `${prefix} ${sample.label} ${metric}=${value}`
                    ).toBeLessThanOrEqual(0.01)
                }
            }
        }
    })

    test('keeps copy label typography stable during layout/presence swap', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'wait')

        const baseline = await sampleButton(page, 'wait')
        const copyStateColor = baseline.labelColor
        const copyShellBorderColor = baseline.buttonBorderColor
        const copyShellBackgroundColor = baseline.buttonBackgroundColor
        const baselineFontSize = Number.parseFloat(baseline.labelFontSize)
        const baselineLineHeight = Number.parseFloat(baseline.labelLineHeight)
        expect(baselineLineHeight).toBeGreaterThanOrEqual(baselineFontSize * 1.15)
        expect(baseline.buttonOverflow).not.toBe('hidden')
        expect(baseline.labelOverflow).not.toBe('hidden')
        await button.click()
        const clickSamples = await collectSamples(page, 'wait', 620)

        await expect(button).toHaveText('copied', { timeout: 2500 })
        await expect(page.getByTestId('wait-copied-state')).toBeVisible({ timeout: 2500 })
        const copiedSample = await sampleButton(page, 'wait')
        const copiedStateColor = copiedSample.labelColor
        const copiedShellBorderColor = copiedSample.buttonBorderColor
        const copiedShellBackgroundColor = copiedSample.buttonBackgroundColor
        await page.waitForTimeout(2200)
        await expect(button).toHaveText('copied')
        await page.waitForTimeout(3300)
        const resetSamples = await collectSamples(page, 'wait', 620)

        const samples = [...clickSamples, ...resetSamples]
        expect(samples.length).toBeGreaterThan(5)

        for (const sample of samples) {
            expect(sample.buttonFontSize).toBe(baseline.buttonFontSize)
            expect(sample.buttonLineHeight).toBe(baseline.buttonLineHeight)
            expect(sample.labelFontSize).toBe(baseline.labelFontSize)
            expect(sample.labelLineHeight).toBe(baseline.labelLineHeight)
            expect(sample.buttonOverflow).not.toBe('hidden')
            expect(sample.labelOverflow).not.toBe('hidden')

            // Layout descendants should keep an effective glyph scale of 1.
            // The implementation can get there via parent FLIP scale with
            // correction or by animating the parent box size directly.
            const effectiveLabelScale =
                parseScaleX(sample.buttonTransform) * parseScaleX(sample.labelTransform)
            expect(Math.abs(effectiveLabelScale - 1)).toBeLessThanOrEqual(0.001)

            // Text state colors shouldn't be inherited from the shell state.
            // Otherwise the outgoing "copy" label flashes accent blue as soon
            // as the parent receives the copied class.
            if (sample.labelClassName.includes('copy-state')) {
                expect(sample.labelColor).toBe(copyStateColor)
                expect(sample.buttonBorderColor).toBe(copyShellBorderColor)
                expect(sample.buttonBackgroundColor).toBe(copyShellBackgroundColor)
            }
            if (sample.labelClassName.includes('copied-state')) {
                expect(sample.labelColor).toBe(copiedStateColor)
                expect(sample.buttonBorderColor).toBe(copiedShellBorderColor)
                expect(sample.buttonBackgroundColor).toBe(copiedShellBackgroundColor)
            }

            expect(sample.labelWidth).toBeGreaterThan(0)
            expect(sample.labelHeight).toBeGreaterThan(0)
        }
    })

    test('keeps the readable label fully opaque during the swap', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'wait')

        await button.click()

        const samples = await page.evaluate(async () => {
            const samples: Array<{ opacity: number; text: string; className: string }> = []
            const started = performance.now()

            return await new Promise<typeof samples>((resolve) => {
                const frame = () => {
                    const button = document.querySelector<HTMLElement>(
                        '[data-testid="wait-button"]'
                    )
                    const buttonRect = button?.getBoundingClientRect()
                    const states = Array.from(
                        document.querySelectorAll<HTMLElement>('.state, .copy-button')
                    )
                    const visibleState = states.find((state) => {
                        const style = getComputedStyle(state)
                        const rect = state.getBoundingClientRect()
                        return (
                            buttonRect &&
                            style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            rect.width > 0 &&
                            rect.height > 0 &&
                            rect.right >= buttonRect.left - 4 &&
                            rect.left <= buttonRect.right + 4 &&
                            rect.bottom >= buttonRect.top - 4 &&
                            rect.top <= buttonRect.bottom + 4
                        )
                    })

                    if (visibleState) {
                        const style = getComputedStyle(visibleState)
                        samples.push({
                            opacity: Number.parseFloat(style.opacity),
                            text: visibleState.textContent?.trim() ?? '',
                            className: visibleState.className
                        })
                    }

                    if (performance.now() - started < 1700) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })
        expect(samples.length).toBeGreaterThan(5)

        for (const sample of samples) {
            expect(
                sample.opacity,
                `${sample.text} ${sample.className} opacity`
            ).toBeGreaterThanOrEqual(0.99)
        }
    })

    test('keeps copy label contained during slow layout animation', async ({ page }) => {
        const prefixes = ['wait', 'sync', 'pop-layout']

        for (const prefix of prefixes) {
            await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

            const button = page.getByTestId(`${prefix}-button`)
            await expect(button).toBeVisible()
            await expect(button).toHaveText('copy')
            await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
            await expectReadyCopyState(page, prefix)

            await button.click()

            const samples = await page.evaluate(async (testIdPrefix) => {
                const samples: Array<{
                    buttonRect: { left: number; right: number; top: number; bottom: number }
                    stateRect: { left: number; right: number; top: number; bottom: number }
                    stateOpacity: number
                    stateText: string
                }> = []
                const started = performance.now()

                return await new Promise<typeof samples>((resolve) => {
                    const frame = () => {
                        const buttonElement = document.querySelector<HTMLElement>(
                            `[data-testid="${testIdPrefix}-button"]`
                        )
                        const stateElement =
                            buttonElement &&
                            Array.from(buttonElement.querySelectorAll<HTMLElement>('.state')).find(
                                (state) => {
                                    const style = getComputedStyle(state)
                                    const rect = state.getBoundingClientRect()
                                    return (
                                        style.display !== 'none' &&
                                        state.getAttribute('data-presence-wait-hidden') !==
                                            'true' &&
                                        !state.closest('[data-clone="true"]') &&
                                        rect.width > 0 &&
                                        rect.height > 0
                                    )
                                }
                            )
                        if (buttonElement && stateElement) {
                            const buttonRect = buttonElement.getBoundingClientRect()
                            const stateRect = stateElement.getBoundingClientRect()
                            const stateStyle = getComputedStyle(stateElement)
                            samples.push({
                                buttonRect: {
                                    left: buttonRect.left,
                                    right: buttonRect.right,
                                    top: buttonRect.top,
                                    bottom: buttonRect.bottom
                                },
                                stateRect: {
                                    left: stateRect.left,
                                    right: stateRect.right,
                                    top: stateRect.top,
                                    bottom: stateRect.bottom
                                },
                                stateOpacity: Number.parseFloat(stateStyle.opacity),
                                stateText: stateElement.textContent?.trim() ?? ''
                            })
                        }

                        if (performance.now() - started < 3600) requestAnimationFrame(frame)
                        else resolve(samples)
                    }
                    requestAnimationFrame(frame)
                })
            }, prefix)

            const tolerance = prefix === 'sync' ? 8 : 3
            const visibleSamples = samples.filter((sample) => sample.stateOpacity > 0.2)
            expect(visibleSamples.length, prefix).toBeGreaterThan(5)

            for (const sample of visibleSamples) {
                expect(sample.stateRect.left, prefix).toBeGreaterThanOrEqual(
                    sample.buttonRect.left - tolerance
                )
                expect(sample.stateRect.right, prefix).toBeLessThanOrEqual(
                    sample.buttonRect.right + tolerance
                )
                expect(sample.stateRect.top, prefix).toBeGreaterThanOrEqual(
                    sample.buttonRect.top - tolerance
                )
                expect(sample.stateRect.bottom, prefix).toBeLessThanOrEqual(
                    sample.buttonRect.bottom + tolerance
                )
            }
        }
    })

    test('keeps the readable active label visually centered during the swap', async ({ page }) => {
        const prefixes = ['wait', 'sync', 'pop-layout']

        for (const prefix of prefixes) {
            await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

            const button = page.getByTestId(`${prefix}-button`)
            await expect(button).toBeVisible()
            await expect(button).toHaveText('copy')
            await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
            await expectReadyCopyState(page, prefix)

            await button.click()

            const samples = await page.evaluate(async (testIdPrefix) => {
                const samples: Array<{
                    buttonWidth: number
                    labelWidth: number
                    labelOpacity: number
                    labelText: string
                    centerDelta: number
                    leftInset: number
                    rightInset: number
                }> = []
                const started = performance.now()

                return await new Promise<typeof samples>((resolve) => {
                    const frame = () => {
                        const buttonElement = document.querySelector<HTMLElement>(
                            `[data-testid="${testIdPrefix}-button"]`
                        )
                        const labelElements = buttonElement
                            ? Array.from(buttonElement.querySelectorAll<HTMLElement>('.state'))
                            : []

                        for (const labelElement of labelElements) {
                            const style = getComputedStyle(labelElement)
                            const labelRect = labelElement.getBoundingClientRect()
                            if (
                                style.display === 'none' ||
                                labelElement.getAttribute('data-presence-wait-hidden') === 'true' ||
                                labelElement.closest('[data-clone="true"]') ||
                                labelRect.width <= 0 ||
                                labelRect.height <= 0
                            ) {
                                continue
                            }

                            const buttonRect = buttonElement!.getBoundingClientRect()
                            samples.push({
                                buttonWidth: buttonRect.width,
                                labelWidth: labelRect.width,
                                labelOpacity: Number.parseFloat(style.opacity),
                                labelText: labelElement.textContent?.trim() ?? '',
                                centerDelta:
                                    labelRect.left +
                                    labelRect.width / 2 -
                                    (buttonRect.left + buttonRect.width / 2),
                                leftInset: labelRect.left - buttonRect.left,
                                rightInset: buttonRect.right - labelRect.right
                            })
                        }

                        if (performance.now() - started < 3600) requestAnimationFrame(frame)
                        else resolve(samples)
                    }
                    requestAnimationFrame(frame)
                })
            }, prefix)

            const readableCopiedSamples = samples.filter(
                (sample) => sample.labelText.includes('copied') && sample.labelOpacity > 0.2
            )
            expect(readableCopiedSamples.length, prefix).toBeGreaterThan(5)

            for (const sample of readableCopiedSamples) {
                expect(Math.abs(sample.centerDelta), prefix).toBeLessThanOrEqual(8.5)
                expect(Math.abs(sample.leftInset - sample.rightInset), prefix).toBeLessThanOrEqual(
                    17
                )
            }
        }
    })

    test('animates the copied label out on reset for every presence mode', async ({ page }) => {
        const prefixes = ['wait', 'sync', 'pop-layout']

        for (const prefix of prefixes) {
            await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

            const button = page.getByTestId(`${prefix}-button`)
            await expect(button).toBeVisible()
            await expect(button).toHaveText('copy')
            await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
            await expectReadyCopyState(page, prefix)

            const clickedAt = Date.now()
            await button.click()
            await expect(page.getByTestId(`${prefix}-copied-presence-state`)).toBeVisible({
                timeout: 2500
            })
            await expect(button).toContainText('copied')

            const resetDelayMs = prefix === 'wait' ? 5200 : 3200
            const elapsedSinceClick = Date.now() - clickedAt
            await page.waitForTimeout(Math.max(0, resetDelayMs - elapsedSinceClick - 60))

            const samples = await page.evaluate(async (testIdPrefix) => {
                const samples: Array<{
                    clone: boolean
                    opacity: number
                    text: string
                    time: number
                }> = []
                const started = performance.now()

                return await new Promise<typeof samples>((resolve) => {
                    const frame = () => {
                        const copiedStates = Array.from(
                            document.querySelectorAll<HTMLElement>(
                                `[data-testid="${testIdPrefix}-copied-presence-state"]`
                            )
                        )

                        for (const state of copiedStates) {
                            const style = getComputedStyle(state)
                            const rect = state.getBoundingClientRect()
                            if (
                                style.display === 'none' ||
                                style.visibility === 'hidden' ||
                                rect.width <= 0 ||
                                rect.height <= 0
                            ) {
                                continue
                            }

                            samples.push({
                                clone: state.getAttribute('data-clone') === 'true',
                                opacity: Number.parseFloat(style.opacity),
                                text: state.textContent?.trim() ?? '',
                                time: performance.now() - started
                            })
                        }

                        if (performance.now() - started < 260) requestAnimationFrame(frame)
                        else resolve(samples)
                    }
                    requestAnimationFrame(frame)
                })
            }, prefix)

            const visibleCopiedSamples = samples.filter(
                (sample) => sample.text.includes('copied') && sample.opacity > 0.02
            )
            expect(visibleCopiedSamples.length, `${prefix} exit sample count`).toBeGreaterThan(5)

            const first = visibleCopiedSamples[0]
            const last = visibleCopiedSamples[visibleCopiedSamples.length - 1]
            expect(first.opacity, `${prefix} exit starts visible`).toBeGreaterThan(0.4)
            expect(last.opacity, `${prefix} exit fades down`).toBeLessThan(first.opacity - 0.2)
            expect(
                visibleCopiedSamples.some(
                    (sample) => sample.opacity > 0.15 && sample.opacity < 0.85
                ),
                `${prefix} exit should include intermediate opacity frames`
            ).toBe(true)
        }
    })

    test('moves the readable active label without one-frame jumps', async ({ page }) => {
        const prefixes = ['wait', 'sync', 'pop-layout']

        for (const prefix of prefixes) {
            await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

            const button = page.getByTestId(`${prefix}-button`)
            await expect(button).toBeVisible()
            await expect(button).toHaveText('copy')
            await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
            await expectReadyCopyState(page, prefix)

            await button.click()

            const sampleDuration = prefix === 'wait' ? 3600 : 2800
            const samples = await page.evaluate(
                async ({ testIdPrefix, duration }) => {
                    const samples: Array<{
                        labelCenterX: number
                        labelOpacity: number
                        labelText: string
                        t: number
                    }> = []
                    const started = performance.now()

                    return await new Promise<typeof samples>((resolve) => {
                        const frame = () => {
                            const buttonElement = document.querySelector<HTMLElement>(
                                `[data-testid="${testIdPrefix}-button"]`
                            )
                            const labelElements = buttonElement
                                ? Array.from(
                                      buttonElement.querySelectorAll<HTMLElement>('.state-content')
                                  )
                                : []

                            for (const labelElement of labelElements) {
                                const style = getComputedStyle(labelElement)
                                const labelRect = labelElement.getBoundingClientRect()
                                if (
                                    style.display === 'none' ||
                                    labelElement.getAttribute('data-presence-wait-hidden') ===
                                        'true' ||
                                    labelElement.closest('[data-presence-wait-hidden="true"]') ||
                                    labelElement.closest('[data-clone="true"]') ||
                                    labelRect.width <= 0 ||
                                    labelRect.height <= 0
                                ) {
                                    continue
                                }

                                samples.push({
                                    labelCenterX: labelRect.left + labelRect.width / 2,
                                    labelOpacity: Number.parseFloat(style.opacity),
                                    labelText: labelElement.textContent?.trim() ?? '',
                                    t: performance.now()
                                })
                            }

                            if (performance.now() - started < duration) requestAnimationFrame(frame)
                            else resolve(samples)
                        }
                        requestAnimationFrame(frame)
                    })
                },
                { testIdPrefix: prefix, duration: sampleDuration }
            )

            const readableCopiedSamples = samples.filter(
                (sample) => sample.labelText.includes('copied') && sample.labelOpacity > 0.2
            )
            expect(readableCopiedSamples.length, prefix).toBeGreaterThan(5)

            // Wait mode can expose one handoff sample as the new label replaces
            // the exiting label. This test guards the tracked label after that
            // handoff; centering during the handoff is covered above.
            const startIndex =
                prefix === 'wait' &&
                readableCopiedSamples.length > 1 &&
                Math.abs(
                    readableCopiedSamples[1].labelCenterX - readableCopiedSamples[0].labelCenterX
                ) > 1
                    ? 1
                    : 0

            expect(readableCopiedSamples.length - startIndex, prefix).toBeGreaterThan(5)

            for (let i = startIndex + 1; i < readableCopiedSamples.length; i += 1) {
                if (prefix === 'wait' && i < 8) continue
                const movement = Math.abs(
                    readableCopiedSamples[i].labelCenterX -
                        readableCopiedSamples[i - 1].labelCenterX
                )
                const maxReadableStep = prefix === 'sync' ? 1 : 1.25
                // Per-FRAME velocity cap, not per-sample: on a slow shared
                // runner rAF samples merge (dt spans 2-3 frames), so the label
                // legitimately moves multiple frames' worth between reads.
                // Scale the cap by elapsed frames; past 4 merged frames the
                // pair can't distinguish smooth motion from a jump, so skip it
                // (the >5 readable-sample guards above keep coverage honest).
                // A true one-frame snap (many px) still exceeds any scaled cap.
                const dt = readableCopiedSamples[i].t - readableCopiedSamples[i - 1].t
                const elapsedFrames = Math.max(1, Math.ceil(dt / 17))
                if (elapsedFrames > 4) continue
                expect(movement, prefix).toBeLessThanOrEqual(maxReadableStep * elapsedFrames)
            }
        }
    })

    test('keeps sync shell anchored while both states are present', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('sync-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'sync')

        await button.click()

        const samples = await page.evaluate(async () => {
            const samples: Array<{
                buttonTop: number
                buttonHeight: number
                buttonCenterX: number
                labelCenterX: number
                labelOpacity: number
                labelText: string
            }> = []
            const started = performance.now()

            return await new Promise<typeof samples>((resolve) => {
                const frame = () => {
                    const buttonElement = document.querySelector<HTMLElement>(
                        '[data-testid="sync-button"]'
                    )
                    const labelElement =
                        buttonElement &&
                        Array.from(buttonElement.querySelectorAll<HTMLElement>('.state-content'))
                            .map((state) => {
                                const style = getComputedStyle(state)
                                const rect = state.getBoundingClientRect()
                                return {
                                    element: state,
                                    opacity: Number.parseFloat(style.opacity),
                                    rect,
                                    visible:
                                        style.display !== 'none' &&
                                        state.getAttribute('data-presence-wait-hidden') !==
                                            'true' &&
                                        !state.closest('[data-clone="true"]') &&
                                        rect.width > 0 &&
                                        rect.height > 0
                                }
                            })
                            .filter((state) => state.visible)
                            .sort((a, b) => b.opacity - a.opacity)[0]

                    if (buttonElement && labelElement) {
                        const buttonRect = buttonElement.getBoundingClientRect()
                        samples.push({
                            buttonTop: buttonRect.top,
                            buttonHeight: buttonRect.height,
                            buttonCenterX: buttonRect.left + buttonRect.width / 2,
                            labelCenterX: labelElement.rect.left + labelElement.rect.width / 2,
                            labelOpacity: labelElement.opacity,
                            labelText: labelElement.element.textContent?.trim() ?? ''
                        })
                    }

                    if (performance.now() - started < 900) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        const visibleSamples = samples.filter((sample) => sample.labelOpacity > 0.2)
        expect(visibleSamples.length).toBeGreaterThan(5)

        for (let i = 1; i < visibleSamples.length; i += 1) {
            const movement = Math.abs(visibleSamples[i].buttonTop - visibleSamples[i - 1].buttonTop)
            expect(movement, `top jump at sample ${i}`).toBeLessThanOrEqual(1)
        }

        for (const sample of visibleSamples) {
            expect(sample.buttonHeight, sample.labelText).toBeLessThanOrEqual(33)
            expect(
                Math.abs(sample.labelCenterX - sample.buttonCenterX),
                sample.labelText
            ).toBeLessThanOrEqual(8.5)
        }
    })

    test('keeps sync shell anchored during reset', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('sync-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'sync')

        await button.click()
        await expect(page.getByTestId('sync-copied-state')).toBeVisible({ timeout: 300 })
        await page.waitForTimeout(3100)

        const samples = await page.evaluate(async () => {
            const samples: Array<{
                buttonCenterX: number
                buttonHeight: number
                buttonTop: number
                buttonWidth: number
                labelCenterX: number
                labelOpacity: number
                labelText: string
            }> = []
            const started = performance.now()

            return await new Promise<typeof samples>((resolve) => {
                const frame = () => {
                    const buttonElement = document.querySelector<HTMLElement>(
                        '[data-testid="sync-button"]'
                    )
                    const labelElement =
                        buttonElement &&
                        Array.from(buttonElement.querySelectorAll<HTMLElement>('.state-content'))
                            .map((state) => {
                                const style = getComputedStyle(state)
                                const rect = state.getBoundingClientRect()
                                return {
                                    element: state,
                                    opacity: Number.parseFloat(style.opacity),
                                    rect,
                                    visible:
                                        style.display !== 'none' &&
                                        state.getAttribute('data-presence-wait-hidden') !==
                                            'true' &&
                                        !state.closest('[data-clone="true"]') &&
                                        rect.width > 0 &&
                                        rect.height > 0
                                }
                            })
                            .filter((state) => state.visible)
                            .sort((a, b) => b.opacity - a.opacity)[0]

                    if (buttonElement && labelElement) {
                        const buttonRect = buttonElement.getBoundingClientRect()
                        samples.push({
                            buttonCenterX: buttonRect.left + buttonRect.width / 2,
                            buttonHeight: buttonRect.height,
                            buttonTop: buttonRect.top,
                            buttonWidth: buttonRect.width,
                            labelCenterX: labelElement.rect.left + labelElement.rect.width / 2,
                            labelOpacity: labelElement.opacity,
                            labelText: labelElement.element.textContent?.trim() ?? ''
                        })
                    }

                    if (performance.now() - started < 900) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        const visibleSamples = samples.filter((sample) => sample.labelOpacity > 0.2)
        expect(visibleSamples.length).toBeGreaterThan(5)

        for (let i = 1; i < visibleSamples.length; i += 1) {
            const topMovement = Math.abs(
                visibleSamples[i].buttonTop - visibleSamples[i - 1].buttonTop
            )
            const centerDeltaChange = Math.abs(
                visibleSamples[i].labelCenterX -
                    visibleSamples[i].buttonCenterX -
                    (visibleSamples[i - 1].labelCenterX - visibleSamples[i - 1].buttonCenterX)
            )
            expect(topMovement, `top jump at sample ${i}`).toBeLessThanOrEqual(1)
            if (visibleSamples[i].labelText !== visibleSamples[i - 1].labelText) continue
            expect(centerDeltaChange, `label drift jump at sample ${i}`).toBeLessThanOrEqual(4)
        }

        for (const sample of visibleSamples) {
            expect(sample.buttonHeight, sample.labelText).toBeLessThanOrEqual(33)
            expect(
                Math.abs(sample.labelCenterX - sample.buttonCenterX),
                sample.labelText
            ).toBeLessThanOrEqual(8.5)
        }
    })

    test('keeps sync return icon and text centered as one unit', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('sync-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'sync')

        await button.click()
        await expect(page.getByTestId('sync-copied-state')).toBeVisible({ timeout: 300 })
        await page.waitForTimeout(3100)

        const samples = await page.evaluate(async () => {
            const samples: Array<{
                buttonCenterX: number
                contentCenterX: number
                contentOpacity: number
                contentText: string
                delta: number
            }> = []
            const started = performance.now()

            return await new Promise<typeof samples>((resolve) => {
                const frame = () => {
                    const buttonElement = document.querySelector<HTMLElement>(
                        '[data-testid="sync-button"]'
                    )
                    const contentElement =
                        buttonElement &&
                        Array.from(buttonElement.querySelectorAll<HTMLElement>('.state-content'))
                            .map((state) => {
                                const style = getComputedStyle(state)
                                const rect = state.getBoundingClientRect()
                                return {
                                    element: state,
                                    opacity: Number.parseFloat(style.opacity),
                                    rect,
                                    visible:
                                        style.display !== 'none' &&
                                        !state.closest('[data-clone="true"]') &&
                                        rect.width > 0 &&
                                        rect.height > 0
                                }
                            })
                            .filter((state) => state.visible)
                            .sort((a, b) => b.opacity - a.opacity)[0]

                    if (buttonElement && contentElement) {
                        const buttonRect = buttonElement.getBoundingClientRect()
                        const buttonCenterX = buttonRect.left + buttonRect.width / 2
                        const contentCenterX =
                            contentElement.rect.left + contentElement.rect.width / 2

                        samples.push({
                            buttonCenterX,
                            contentCenterX,
                            contentOpacity: contentElement.opacity,
                            contentText: contentElement.element.textContent?.trim() ?? '',
                            delta: contentCenterX - buttonCenterX
                        })
                    }

                    if (performance.now() - started < 900) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        const readableCopySamples = samples.filter(
            (sample) => sample.contentText.includes('copy') && sample.contentOpacity > 0.2
        )
        expect(readableCopySamples.length).toBeGreaterThan(5)

        for (const sample of readableCopySamples) {
            expect(
                Math.abs(sample.delta),
                `${sample.contentText} content delta ${sample.delta}`
            ).toBeLessThanOrEqual(4)
        }
    })

    test('does not leave the sync copy icon overlapping the copied label', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('sync-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'sync')

        const samplesPromise = button.evaluate(async (element) => {
            const isPainted = (node: HTMLElement) => {
                let current: HTMLElement | null = node

                while (current && current !== element.parentElement) {
                    const style = getComputedStyle(current)
                    if (
                        style.display === 'none' ||
                        style.visibility === 'hidden' ||
                        Number.parseFloat(style.opacity) <= 0.05
                    ) {
                        return false
                    }
                    current = current.parentElement
                }

                return true
            }

            const read = (selector: string) =>
                Array.from(element.querySelectorAll<HTMLElement>(selector))
                    .map((node) => {
                        const rect = node.getBoundingClientRect()
                        return {
                            bottom: rect.bottom,
                            height: rect.height,
                            left: rect.left,
                            opacity: Number.parseFloat(getComputedStyle(node).opacity),
                            right: rect.right,
                            top: rect.top,
                            visible: isPainted(node) && rect.width > 0 && rect.height > 0
                        }
                    })
                    .filter((entry) => entry.visible)

            const samples: Array<{ copiedVisible: boolean; copyIconCount: number; time: number }> =
                []
            const started = performance.now()

            return await new Promise<typeof samples>((resolve) => {
                const frame = () => {
                    const copiedIcons = read('[data-testid="sync-copied-icon"]')
                    const oldCopyIcons = read('[data-testid="sync-copy-icon"]')
                    samples.push({
                        copiedVisible: copiedIcons.some((icon) => icon.opacity > 0.2),
                        copyIconCount: oldCopyIcons.filter((icon) => icon.opacity > 0.2).length,
                        time: performance.now() - started
                    })

                    if (performance.now() - started < 420) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        await button.click()
        await expect(page.getByTestId('sync-copied-presence-state')).toBeVisible({
            timeout: 1000
        })
        const samples = await samplesPromise

        const staleCopyIconFrames = samples.filter(
            (sample) => sample.copiedVisible && sample.copyIconCount > 0
        )
        expect(staleCopyIconFrames, JSON.stringify(staleCopyIconFrames.slice(0, 8))).toHaveLength(0)
    })

    test('restores button size after the page scrolls during layout animation', async ({
        page
    }) => {
        const prefixes = ['wait', 'sync']

        for (const prefix of prefixes) {
            await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')
            await page.evaluate(() => window.scrollTo(0, 0))

            const button = page.getByTestId(`${prefix}-button`)
            await expect(button).toBeVisible()
            await expect(button).toHaveText('copy')
            await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
            await expectReadyCopyState(page, prefix)

            const before = await sampleButtonBox(page, prefix)

            await button.click()
            await page.waitForTimeout(350)
            await page.evaluate(() => window.scrollBy(0, 240))
            await expect(button).toHaveText('copy', { timeout: prefix === 'wait' ? 9000 : 7000 })
            await page.waitForFunction(
                (testIdPrefix) => {
                    const buttonElement = document.querySelector<HTMLElement>(
                        `[data-testid="${testIdPrefix}-button"]`
                    )
                    return !buttonElement?.hasAttribute('data-layout-size-animation')
                },
                prefix,
                { timeout: 3500 }
            )

            await expect
                .poll(
                    async () => {
                        const sample = await sampleButtonBox(page, prefix)
                        return (
                            sample.text === before.text &&
                            Math.abs(sample.documentTop - before.documentTop) <= 1 &&
                            Math.abs(sample.height - before.height) <= 1 &&
                            Math.abs(sample.width - before.width) <= 1
                        )
                    },
                    {
                        message: `${prefix} button should settle back to its pre-scroll copy geometry`,
                        timeout: prefix === 'wait' ? 2500 : 1600
                    }
                )
                .toBe(true)

            const after = await sampleButtonBox(page, prefix)
            expect(after.text, prefix).toBe(before.text)
            expect(Math.abs(after.documentTop - before.documentTop), prefix).toBeLessThanOrEqual(1)
            expect(Math.abs(after.height - before.height), prefix).toBeLessThanOrEqual(1)
            expect(Math.abs(after.width - before.width), prefix).toBeLessThanOrEqual(1)
        }
    })

    test('wait mode settles copied size when release happens fully offscreen', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 360 })
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')
        await page.evaluate(() => window.scrollTo(0, 0))

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'wait')

        const before = await sampleButtonBox(page, 'wait')

        await button.click()
        await page.waitForTimeout(150)
        await button.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            window.scrollBy(0, rect.bottom + 32)
        })
        await page.waitForFunction(() => {
            const buttonElement = document.querySelector<HTMLElement>('[data-testid="wait-button"]')
            return !!buttonElement && buttonElement.getBoundingClientRect().bottom <= 0
        })
        await expect(page.getByTestId('wait-copied-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 4000 }
        )
        await page.evaluate(() => window.scrollTo(0, 0))

        const readVisibleText = () =>
            button.evaluate((element) => {
                const states = Array.from(element.querySelectorAll<HTMLElement>('.state-content'))
                    .map((state) => {
                        const style = getComputedStyle(state)
                        const rect = state.getBoundingClientRect()
                        return {
                            opacity: Number.parseFloat(style.opacity),
                            text: state.textContent?.trim() ?? '',
                            visible:
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                !state.closest('[data-presence-wait-hidden="true"]') &&
                                rect.width > 0 &&
                                rect.height > 0
                        }
                    })
                    .filter((state) => state.visible)
                    .sort((a, b) => b.opacity - a.opacity)

                return states[0]?.text ?? ''
            })

        await expect
            .poll(readVisibleText, {
                message: 'wait button should settle on copied after offscreen release',
                timeout: 1200
            })
            .toBe('copied')

        const returned = await sampleButtonBox(page, 'wait')
        expect(returned.width).toBeGreaterThan(before.width + 4)
    })

    test('animates button width instead of snapping to the final size', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'wait')

        const baselineWidth = await button.evaluate(
            (element) => element.getBoundingClientRect().width
        )

        await button.click()
        await expect(page.getByTestId('wait-copied-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 2500 }
        )

        const samples = await page.evaluate(async () => {
            const buttonElement = document.querySelector<HTMLElement>('[data-testid="wait-button"]')
            if (!buttonElement) throw new Error('missing wait button')

            const widths: number[] = []
            const started = performance.now()

            return await new Promise<number[]>((resolve) => {
                const frame = () => {
                    widths.push(buttonElement.getBoundingClientRect().width)
                    if (performance.now() - started < 2600) requestAnimationFrame(frame)
                    else resolve(widths)
                }
                requestAnimationFrame(frame)
            })
        })

        await page.waitForFunction(() => {
            const buttonElement = document.querySelector<HTMLElement>('[data-testid="wait-button"]')
            return buttonElement && buttonElement.style.width === ''
        })

        const settledWidth = await button.evaluate(
            (element) => element.getBoundingClientRect().width
        )
        expect(settledWidth).toBeGreaterThan(baselineWidth + 4)

        const intermediateWidths = samples.filter(
            (width) => width > baselineWidth + 1 && width < settledWidth - 1
        )
        expect(intermediateWidths.length).toBeGreaterThan(3)
        expect(Math.max(...samples)).toBeLessThanOrEqual(settledWidth + 2)
    })

    test('animates sync button width when the copied label enters', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('sync-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'sync')

        const baselineWidth = await button.evaluate(
            (element) => element.getBoundingClientRect().width
        )

        const samplesPromise = page.evaluate(async () => {
            const buttonElement = document.querySelector<HTMLElement>('[data-testid="sync-button"]')
            if (!buttonElement) throw new Error('missing sync button')

            const samples: Array<{ time: number; width: number }> = []
            const started = performance.now()

            return await new Promise<typeof samples>((resolve) => {
                const frame = () => {
                    samples.push({
                        time: performance.now() - started,
                        width: buttonElement.getBoundingClientRect().width
                    })

                    if (performance.now() - started < 650) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        await button.click()
        await expect(page.getByTestId('sync-copied-presence-state')).toBeVisible({
            timeout: 1000
        })

        const samples = await samplesPromise

        await page.waitForTimeout(2600)
        const settledCopiedWidth = await button.evaluate(
            (element) => element.getBoundingClientRect().width
        )

        expect(settledCopiedWidth).toBeGreaterThan(baselineWidth + 4)

        const intermediateWidths = samples.filter(
            (sample) =>
                sample.time > 16 &&
                sample.width > baselineWidth + 1 &&
                sample.width < settledCopiedWidth - 1
        )
        expect(intermediateWidths.length, JSON.stringify(samples.slice(0, 12))).toBeGreaterThan(3)
        expect(samples[0].width).toBeLessThan(baselineWidth + 2)
    })

    test('keeps wait-mode readable text at natural scale during size animation', async ({
        page
    }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'wait')

        await button.click()
        await expect(page.getByTestId('wait-copied-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 2500 }
        )

        const samples = await page.evaluate(async () => {
            type PaintSample = {
                buttonLeft: number
                buttonWidth: number
                effectiveScaleX: number
                labelOpacity: number
                labelScaleX: number
                labelText: string
            }

            const parseScaleX = (transform: string): number => {
                if (!transform || transform === 'none') return 1
                const matrix = transform.match(/^matrix\(([^)]+)\)$/)
                if (!matrix) return 1
                const [a] = matrix[1].split(',').map((value) => Number.parseFloat(value.trim()))
                return Number.isFinite(a) ? a : 1
            }

            const effectiveScaleX = (element: HTMLElement, stopAt: HTMLElement): number => {
                let scale = 1
                let current: HTMLElement | null = element
                while (current) {
                    scale *= parseScaleX(getComputedStyle(current).transform)
                    if (current === stopAt) break
                    current = current.parentElement
                }
                return scale
            }

            const buttonElement = document.querySelector<HTMLElement>('[data-testid="wait-button"]')
            if (!buttonElement) throw new Error('missing wait button')

            const samples: PaintSample[] = []
            const started = performance.now()

            return await new Promise<PaintSample[]>((resolve) => {
                const frame = () => {
                    const labelElement = Array.from(
                        buttonElement.querySelectorAll<HTMLElement>('.state')
                    ).find((state) => {
                        const style = getComputedStyle(state)
                        const rect = state.getBoundingClientRect()
                        return (
                            style.display !== 'none' &&
                            state.getAttribute('data-presence-wait-hidden') !== 'true' &&
                            !state.closest('[data-clone="true"]') &&
                            rect.width > 0 &&
                            rect.height > 0 &&
                            Number.parseFloat(style.opacity) > 0.2
                        )
                    })

                    if (labelElement) {
                        const buttonRect = buttonElement.getBoundingClientRect()
                        const labelStyle = getComputedStyle(labelElement)
                        samples.push({
                            buttonLeft: buttonRect.left,
                            buttonWidth: buttonRect.width,
                            effectiveScaleX: effectiveScaleX(labelElement, buttonElement),
                            labelOpacity: Number.parseFloat(labelStyle.opacity),
                            labelScaleX: parseScaleX(labelStyle.transform),
                            labelText: labelElement.textContent?.trim() ?? ''
                        })
                    }

                    if (performance.now() - started < 900) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        const copiedSamples = samples.filter((sample) => sample.labelText.includes('copied'))
        expect(copiedSamples.length).toBeGreaterThan(10)

        const scaledLabelSamples = copiedSamples.filter(
            (sample) => Math.abs(sample.effectiveScaleX - 1) > 0.001
        )
        expect(
            scaledLabelSamples.slice(0, 5),
            `scaled readable label samples: ${JSON.stringify(scaledLabelSamples.slice(0, 5))}`
        ).toEqual([])
    })

    test('keeps wait-mode copied label at natural scale without width reversal', async ({
        page
    }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveText('copy')
        await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
        await expectReadyCopyState(page, 'wait')

        const baselineWidth = await button.evaluate(
            (element) => element.getBoundingClientRect().width
        )

        await button.click()
        await expect(page.getByTestId('wait-copied-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 2500 }
        )

        const samples = await page.evaluate(async () => {
            type WidthSample = {
                buttonWidth: number
                buttonCenterX: number
                buttonScaleX: number
                labelCenterX: number
                labelScaleX: number
                labelOpacity: number
                labelText: string
            }

            const parseScaleX = (transform: string): number => {
                if (!transform || transform === 'none') return 1
                const matrix = transform.match(/^matrix\(([^)]+)\)$/)
                if (!matrix) return 1
                const [a] = matrix[1].split(',').map((value) => Number.parseFloat(value.trim()))
                return Number.isFinite(a) ? a : 1
            }

            const samples: WidthSample[] = []
            const started = performance.now()

            return await new Promise<WidthSample[]>((resolve) => {
                const frame = () => {
                    const buttonElement = document.querySelector<HTMLElement>(
                        '[data-testid="wait-button"]'
                    )
                    const labelElement =
                        buttonElement &&
                        Array.from(buttonElement.querySelectorAll<HTMLElement>('.state')).find(
                            (state) => {
                                const style = getComputedStyle(state)
                                const rect = state.getBoundingClientRect()
                                return (
                                    style.display !== 'none' &&
                                    state.getAttribute('data-presence-wait-hidden') !== 'true' &&
                                    !state.closest('[data-clone="true"]') &&
                                    rect.width > 0 &&
                                    rect.height > 0
                                )
                            }
                        )

                    if (buttonElement && labelElement) {
                        const buttonStyle = getComputedStyle(buttonElement)
                        const labelStyle = getComputedStyle(labelElement)
                        const buttonRect = buttonElement.getBoundingClientRect()
                        const labelRect = labelElement.getBoundingClientRect()
                        samples.push({
                            buttonWidth: buttonRect.width,
                            buttonCenterX: buttonRect.left + buttonRect.width / 2,
                            buttonScaleX: parseScaleX(buttonStyle.transform),
                            labelCenterX: labelRect.left + labelRect.width / 2,
                            labelScaleX: parseScaleX(labelStyle.transform),
                            labelOpacity: Number.parseFloat(labelStyle.opacity),
                            labelText: labelElement.textContent?.trim() ?? ''
                        })
                    }

                    if (performance.now() - started < 3200) requestAnimationFrame(frame)
                    else resolve(samples)
                }
                requestAnimationFrame(frame)
            })
        })

        const visibleCopiedSamples = samples.filter(
            (sample) => sample.labelText.includes('copied') && sample.labelOpacity > 0.2
        )
        expect(visibleCopiedSamples.length).toBeGreaterThan(10)

        for (const sample of visibleCopiedSamples) {
            expect(Math.abs(sample.buttonScaleX * sample.labelScaleX - 1)).toBeLessThanOrEqual(
                0.001
            )
        }

        const grownSamples = visibleCopiedSamples.filter(
            (sample) => sample.buttonWidth > baselineWidth + 2
        )
        expect(grownSamples.length).toBeGreaterThan(5)

        const maxWidth = Math.max(...grownSamples.map((sample) => sample.buttonWidth))
        const finalWidth = grownSamples.at(-1)?.buttonWidth ?? 0
        expect(finalWidth).toBeGreaterThanOrEqual(maxWidth - 1)

        await expect
            .poll(async () => {
                return page.getByTestId('wait-button').evaluate((buttonElement) => {
                    const labelElement = buttonElement.querySelector<HTMLElement>('.state')
                    if (!labelElement) return Number.POSITIVE_INFINITY

                    const buttonRect = buttonElement.getBoundingClientRect()
                    const labelRect = labelElement.getBoundingClientRect()

                    return Math.abs(
                        labelRect.left +
                            labelRect.width / 2 -
                            (buttonRect.left + buttonRect.width / 2)
                    )
                })
            })
            .toBeLessThanOrEqual(1)
    })

    test('coordinates layout participation by presence mode', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const waitButton = page.getByTestId('wait-button')
        const syncButton = page.getByTestId('sync-button')
        const popLayoutButton = page.getByTestId('pop-layout-button')

        await expect(waitButton).toHaveAttribute('data-layout', 'true', { timeout: 3000 })
        await expect(syncButton).toHaveAttribute('data-layout', 'true')
        await expect(popLayoutButton).toHaveAttribute('data-layout', 'true')

        await waitButton.click()
        await expect(page.getByTestId('wait-copied-presence-state')).toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 300 }
        )
        await expect(page.getByTestId('wait-copied-presence-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 2500 }
        )

        await syncButton.click()
        await expect(page.getByTestId('sync-copied-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 300 }
        )
        await expect(page.getByTestId('sync-button')).toContainText('copied', { timeout: 300 })

        await popLayoutButton.click()
        await expect(page.getByTestId('pop-layout-copied-state')).not.toHaveAttribute(
            'data-presence-wait-hidden',
            'true',
            { timeout: 300 }
        )
        await expect(page.getByTestId('pop-layout-button')).toContainText('copied', {
            timeout: 300
        })
        await expect(page.locator('[data-presence-placeholder="true"]')).toHaveCount(0)
    })
})

test.describe('wait-mode swap with the page scrolled (#437)', () => {
    /**
     * Regression: the presence-hold release seam diffs the hold parent's
     * captured `previousRect` against a page-space measurement. When the
     * capture is viewport-relative and the page is scrolled, the release FLIP
     * carries a phantom delta of exactly -scrollY — the entering label paints
     * in place for a frame, then flies in from ~a full scroll-offset away
     * (observed live at scrollY≈220: `translate3d(3.65px, -219.586px, 0px)`).
     *
     * The unscrolled variants above never catch this because page space and
     * viewport space coincide at scrollY=0.
     */
    test('entering wait label never carries a scroll-magnitude translate', async ({ page }) => {
        await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

        const button = page.getByTestId('wait-button')
        await expect(button).toBeVisible()

        // Put the wait button mid-viewport like a real user reading the page.
        await button.evaluate((el) => el.scrollIntoView({ block: 'center' }))
        await page.waitForTimeout(400)

        const scrollY = await page.evaluate(() => window.scrollY)
        expect(scrollY, 'setup: the page must actually be scrolled').toBeGreaterThan(120)

        // Sample the state span (the presence-hold parent) and the entering
        // presence child every frame through the exit (180ms) + release FLIP
        // window. A phantom release delta shows up as a translate on the
        // order of scrollY; legitimate label FLIPs move a few px at most.
        // The sampler starts BEFORE the click (same latency guard as the
        // scroll-during-layout suite) so a slow click round-trip can't let
        // the peak decay before the first sampled frame.
        const samplesPromise = sampleTransformSeries(
            page,
            [
                '[data-testid="wait-copied-state"]',
                '[data-testid="wait-copy-state"]',
                '[data-testid="wait-copied-presence-state"]'
            ],
            1200
        )
        await button.click()
        const samples = await samplesPromise
        expect(
            samples.length,
            'sampler must observe at least one matching element'
        ).toBeGreaterThan(0)
        const worst = samples.reduce(
            (acc, sample) => (Math.abs(sample.ty) > Math.abs(acc.ty) ? sample : acc),
            { selector: '(none)', tx: 0, ty: 0, atMs: 0 }
        )
        const worstLabel = `${worst.selector} @ ${worst.atMs}ms → tx=${worst.tx} ty=${worst.ty}`

        expect(
            Math.abs(worst.ty),
            `no scroll-magnitude translate on the entering label; worst: ${worstLabel}`
        ).toBeLessThan(Math.max(80, scrollY * 0.5))
        expect(Math.abs(worst.tx), `no phantom x translate; worst: ${worstLabel}`).toBeLessThan(80)
    })
})
