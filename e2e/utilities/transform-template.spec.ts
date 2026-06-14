import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/transform-template?@isPlaywright=true'

const readStyleAttribute = (page: Page, testId: string) => async () =>
    page.getByTestId(testId).evaluate((element) => element.getAttribute('style') ?? '')

const readComputedTransform = (page: Page, testId: string) => async () =>
    page.getByTestId(testId).evaluate((element) => getComputedStyle(element).transform)

const readMixedTransformState = (page: Page) => async () =>
    page.getByTestId('template-style-animated').evaluate((element) => {
        const style = getComputedStyle(element)
        const matrix = style.transform.match(/^matrix\(([^,]+),\s*([^,]+)/)
        const angle = matrix
            ? Math.round(
                  (Math.atan2(Number.parseFloat(matrix[2]), Number.parseFloat(matrix[1])) * 180) /
                      Math.PI
              )
            : null
        return {
            inline: element.getAttribute('style') ?? '',
            transform: style.transform,
            rotate: style.rotate,
            angle
        }
    })

const readTransformAngle = (transform: string): number | null => {
    const matrix = transform.match(/^matrix\(([^,]+),\s*([^,]+)/)
    if (!matrix) return null
    return Math.round(
        (Math.atan2(Number.parseFloat(matrix[2]), Number.parseFloat(matrix[1])) * 180) / Math.PI
    )
}

const waitForMotionReady = async (page: Page, testId: string) => {
    await expect(page.getByTestId(testId)).toHaveAttribute('data-is-loaded', 'ready')
}

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

        await waitForMotionReady(page, 'template-slow-animated')
        const toggle = page.getByTestId('template-slow-animated-toggle')
        await expect(toggle).toHaveText('Send')
        await toggle.click()
        await expect(toggle).toHaveText('Back')

        await expect
            .poll(
                async () => {
                    const style =
                        (await page.getByTestId('template-slow-animated').getAttribute('style')) ??
                        ''
                    const y = style.match(/translateY\(([-\d.]+)px\)/)
                    const x = style.match(/translateX\(([-\d.]+)px\)/)
                    if (!y || !x) return false

                    const yValue = Number.parseFloat(y[1])
                    const xValue = Number.parseFloat(x[1])

                    return yValue > 10 && yValue < 110 && Math.abs(yValue - xValue) < 0.5
                },
                { intervals: [16, 16, 16, 32, 50, 50, 100], timeout: 4000 }
            )
            .toBe(true)
    })

    test('starts repeated transformTemplate animations from the current transform', async ({
        page
    }) => {
        await page.goto(URL)

        await waitForMotionReady(page, 'template-slow-animated')
        const toggle = page.getByTestId('template-slow-animated-toggle')
        await expect(toggle).toHaveText('Send')
        await toggle.click()

        await expect
            .poll(readStyleAttribute(page, 'template-slow-animated'), { timeout: 6000 })
            .toContain('translateX(120px)')

        await toggle.click()

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

        expect(xValues.length).toBeGreaterThan(0)
        expect(xValues[0]).toBeGreaterThan(80)
        expect(xValues.some((value) => value > 20 && value < 115)).toBe(true)
    })

    test('applies transformTemplate throughout animation controls frames', async ({ page }) => {
        await page.goto(URL)

        await waitForMotionReady(page, 'template-controls-animated')
        const toggle = page.getByTestId('template-controls-animated-toggle')
        await expect(toggle).toHaveText('Send')
        await toggle.click()
        await expect(toggle).toHaveText('Back')

        const sampledTransforms = await page.getByTestId('template-controls-animated').evaluate(
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

    test('preserves style transforms during templated target animations', async ({ page }) => {
        await page.goto(URL)

        await waitForMotionReady(page, 'template-style-animated')
        await page.getByTestId('template-style-animated-toggle').click()

        await expect
            .poll(readStyleAttribute(page, 'template-style-animated'))
            .toContain('translateX(120px)')
        await expect.poll(readMixedTransformState(page)).toMatchObject({
            angle: 8
        })
        await expect
            .poll(readStyleAttribute(page, 'template-style-animated'))
            .not.toContain('rotateZ(8deg)')

        await page.getByTestId('template-style-animated-toggle').click()
        const returnFrames = await page.getByTestId('template-style-animated').evaluate(
            async (element) =>
                await new Promise<string[]>((resolve) => {
                    const frames: string[] = []
                    const started = performance.now()

                    const tick = () => {
                        frames.push(getComputedStyle(element).transform)
                        if (performance.now() - started < 180) {
                            requestAnimationFrame(tick)
                        } else {
                            resolve(frames)
                        }
                    }

                    requestAnimationFrame(tick)
                })
        )
        const returnAngles = returnFrames
            .map(readTransformAngle)
            .filter((angle): angle is number => angle !== null)

        expect(returnAngles.length).toBeGreaterThan(0)
        expect(returnAngles.every((angle) => angle === 8)).toBe(true)

        await expect
            .poll(readStyleAttribute(page, 'template-style-animated'), { timeout: 3000 })
            .toContain('translateY(0px)')
        const settledState = await readMixedTransformState(page)()
        await page.waitForTimeout(500)
        const postSettleState = await readMixedTransformState(page)()

        expect(postSettleState).toEqual(settledState)
    })

    test('supports keyboard activation and accessible names for transform toggles', async ({
        page
    }) => {
        await page.goto(URL)

        const updateToggle = page.getByTestId('template-update-toggle')
        const animatedToggle = page.getByTestId('template-animated-toggle')

        await expect(updateToggle).toHaveAccessibleName('Double')
        await expect(animatedToggle).toHaveAccessibleName('Send')

        await updateToggle.focus()
        await page.keyboard.press('Enter')

        await expect
            .poll(readStyleAttribute(page, 'template-updated'))
            .toContain('translateY(20px) translateX(10px)')

        await animatedToggle.focus()
        await page.keyboard.press('Enter')

        await expect(animatedToggle).toHaveText('Back')
        await expect
            .poll(readStyleAttribute(page, 'template-animated'), { timeout: 3000 })
            .toContain('translateX(120px)')
    })

    test('applies transformPerspective through transformTemplate', async ({ page }) => {
        await page.goto(URL)
        const lens = page.getByTestId('template-perspective')

        await expect
            .poll(readStyleAttribute(page, 'template-perspective'))
            .toContain('perspective(400px) translateX(100px) translateZ(80px)')
        await expect(lens).toBeVisible()
        await expect
            .poll(() => lens.evaluate((element) => element.getBoundingClientRect().width))
            .toBeGreaterThan(100)
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: 'transformTemplate' })).toHaveAttribute(
            'href',
            /\/tests\/transform-template/
        )
    })
})
