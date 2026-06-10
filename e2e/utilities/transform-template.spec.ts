import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/transform-template?@isPlaywright=true'

const readStyleAttribute = (page: Page, testId: string) => async () =>
    page.getByTestId(testId).evaluate((element) => element.getAttribute('style') ?? '')

const readComputedTransform = (page: Page, testId: string) => async () =>
    page.getByTestId(testId).evaluate((element) => getComputedStyle(element).transform)

test.describe('transformTemplate', () => {
    test('applies transformTemplate on initial render', async ({ page }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-initial'))
            .toContain('transform: translateY(10px) translateX(10px)')
    })

    test('applies updated transformTemplate', async ({ page }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-updated'))
            .toContain('translateY(10px) translateX(10px)')

        await page.getByTestId('template-update-toggle').click()

        await expect
            .poll(readStyleAttribute(page, 'template-updated'))
            .toContain('translateY(20px) translateX(10px)')
    })

    test('renders transform with transformTemplate', async ({ page }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-style'))
            .toContain('transform: translateY(20px) translateX(10px)')
    })

    test('renders transformTemplate without any transform', async ({ page }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-only'))
            .toContain('transform: translateY(20px)')
    })

    test('removes transformTemplate if prop is removed and transform is changed', async ({
        page
    }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-remove-changed'))
            .toContain('transform: translateY(20px)')

        await page.getByTestId('template-remove-changed-toggle').click()

        await expect
            .poll(readStyleAttribute(page, 'template-remove-changed'))
            .toContain('transform: translateX(20px)')
    })

    test('removes transformTemplate if prop is removed and transform is not changed', async ({
        page
    }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-remove-same'))
            .toContain('transform: translateY(20px)')

        await page.getByTestId('template-remove-same-toggle').click()

        await expect
            .poll(readStyleAttribute(page, 'template-remove-same'))
            .toContain('transform: translateX(10px)')
    })

    test('removes transformTemplate if prop is removed', async ({ page }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-remove-only'))
            .toContain('transform: translateY(20px)')

        await page.getByTestId('template-remove-only-toggle').click()

        await expect.poll(readComputedTransform(page, 'template-remove-only')).toBe('none')
    })

    test('applies transformTemplate to animated resting styles', async ({ page }) => {
        await page.goto(URL)

        await page.getByTestId('template-animated-toggle').click()

        await expect
            .poll(readStyleAttribute(page, 'template-animated'))
            .toContain('translateY(120px)')
        await expect
            .poll(readStyleAttribute(page, 'template-animated'))
            .toContain('translateX(120px)')
        await expect.poll(readStyleAttribute(page, 'template-animated')).toContain('rotateZ(30deg)')
    })

    test('applies transformTemplate throughout transform animation frames', async ({ page }) => {
        await page.goto(URL)

        await page.waitForTimeout(250)
        await page.getByTestId('template-slow-animated-toggle').click()
        await expect(page.getByTestId('template-slow-animated-toggle')).toHaveText('Back')

        const sampledTransforms = await page.getByTestId('template-slow-animated').evaluate(
            async (element) =>
                await new Promise<string[]>((resolve) => {
                    const frames: string[] = []
                    const started = performance.now()

                    const tick = () => {
                        frames.push(element.getAttribute('style') ?? '')
                        if (performance.now() - started < 700) {
                            requestAnimationFrame(tick)
                        } else {
                            resolve(frames)
                        }
                    }

                    requestAnimationFrame(tick)
                })
        )

        const templatedIntermediateFrame = sampledTransforms.find((style) => {
            const y = style.match(/translateY\(([-\d.]+)px\)/)
            const x = style.match(/translateX\(([-\d.]+)px\)/)
            if (!y || !x) return false

            const yValue = Number.parseFloat(y[1])
            const xValue = Number.parseFloat(x[1])

            return yValue > 10 && yValue < 110 && Math.abs(yValue - xValue) < 0.5
        })

        expect(templatedIntermediateFrame).toBeTruthy()
    })

    test('starts repeated transformTemplate animations from the current transform', async ({
        page
    }) => {
        await page.goto(URL)

        await page.waitForTimeout(250)
        await page.getByTestId('template-slow-animated-toggle').click()

        await expect
            .poll(readStyleAttribute(page, 'template-slow-animated'), { timeout: 3000 })
            .toContain('translateX(120px)')

        await page.getByTestId('template-slow-animated-toggle').click()

        const sampledTransforms = await page.getByTestId('template-slow-animated').evaluate(
            async (element) =>
                await new Promise<string[]>((resolve) => {
                    const frames: string[] = []
                    const started = performance.now()

                    const tick = () => {
                        frames.push(element.getAttribute('style') ?? '')
                        if (performance.now() - started < 120) {
                            requestAnimationFrame(tick)
                        } else {
                            resolve(frames)
                        }
                    }

                    requestAnimationFrame(tick)
                })
        )

        const xValues = sampledTransforms
            .map((style) => style.match(/translateX\(([-\d.]+)px\)/)?.[1])
            .filter((value): value is string => !!value)
            .map(Number.parseFloat)

        expect(xValues[0]).toBeGreaterThan(80)
        expect(xValues.some((value) => value > 20 && value < 115)).toBe(true)
    })

    test('applies transformPerspective through transformTemplate', async ({ page }) => {
        await page.goto(URL)

        await expect
            .poll(readStyleAttribute(page, 'template-perspective'))
            .toContain('perspective(200px) translateX(100px) translateZ(200px)')
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: 'transformTemplate' })).toHaveAttribute(
            'href',
            /\/tests\/transform-template/
        )
    })
})
