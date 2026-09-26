import { expect, test, type Locator, type Page } from '@playwright/test'

const pathLabel = 'A glowing winding path with an adjustable visible segment'

function demo(page: Page) {
    return page.locator('.playground').filter({ has: page.getByRole('img', { name: pathLabel }) })
}

async function strokes(example: Locator) {
    return example.locator('svg path[pathLength="1"]').evaluateAll((paths) =>
        paths.map((path) => {
            const style = getComputedStyle(path)
            return {
                dash: style.strokeDasharray.split(/[\s,]+/).map(Number.parseFloat),
                offset: Number.parseFloat(style.strokeDashoffset),
                width: Number.parseFloat(style.strokeWidth)
            }
        })
    )
}

async function expectRange(example: Locator, dash: number, offset = 0, timeout = 5000) {
    await expect
        .poll(() => strokes(example), { timeout, intervals: [25, 50, 100] })
        .toEqual(
            [16, 4].map((width) => ({
                dash: [expect.closeTo(dash, 2), expect.closeTo(1, 2)],
                offset: expect.closeTo(offset, 2),
                width
            }))
        )
}

async function expectPhase(example: Locator, phase: (_dash: number, _offset: number) => boolean) {
    await expect
        .poll(
            async () =>
                (await strokes(example)).map(
                    ({ dash, offset, width }) =>
                        dash.length === 2 &&
                        [...dash, offset, width].every(Number.isFinite) &&
                        Math.abs(dash[1] - 1) < 0.005 &&
                        width > 0 &&
                        phase(dash[0], offset)
                ),
            { timeout: 5000, intervals: [25, 50, 100] }
        )
        .toEqual([true, true])
}

async function setSlider(example: Locator, name: string, value: number) {
    const slider = example.getByRole('slider', { name })
    await slider.focus()
    await slider.press(value > 50 ? 'End' : 'Home')
    for (let step = 0; step < Math.min(value, 100 - value); step++) {
        await slider.press(value > 50 ? 'ArrowLeft' : 'ArrowRight')
    }
    await expect(slider).toHaveValue(String(value))
}

async function openDemo(page: Page) {
    await page.goto('/examples/svg-css-variables')
    const example = demo(page)
    await expect(example).toBeVisible()
    return example
}

test.afterEach(async ({ page }) => {
    expect(await page.pageErrors(), 'the real docs route must not throw browser errors').toEqual([])
})

test('both SVG paths render a valid initial dash and offset', async ({ page }) => {
    await expectRange(await openDemo(page), 0.65)
})

test('Draw, Erase, and Reset update both rendered paths', async ({ page }) => {
    const example = await openDemo(page)
    await example.getByRole('button', { name: 'Draw', exact: true }).click()
    await expectRange(example, 1)
    await example.getByRole('button', { name: 'Erase', exact: true }).click()
    await expectRange(example, 0)
    await example.getByRole('button', { name: 'Reset', exact: true }).click()
    await expectRange(example, 0.65)
})

test('sliders trim the segment and clamp both endpoints', async ({ page }) => {
    const example = await openDemo(page)
    await setSlider(example, 'Trim end', 75)
    await setSlider(example, 'Trim start', 25)
    await expectRange(example, 0.5, -0.25)

    await setSlider(example, 'Trim start', 100)
    await expect(example.getByRole('slider', { name: 'Trim end' })).toHaveValue('100')
    await expectRange(example, 0, -1)

    await setSlider(example, 'Trim end', 0)
    await expect(example.getByRole('slider', { name: 'Trim start' })).toHaveValue('0')
    await expectRange(example, 0)

    await setSlider(example, 'Trim end', 100)
    await expectRange(example, 1)
})

test('Replay actually draws, erases from the tail, and returns', async ({ page }) => {
    const example = await openDemo(page)
    await expectRange(example, 0.65)
    await example.getByRole('button', { name: 'Replay', exact: true }).click()
    await expectPhase(
        example,
        (dash, offset) => dash > 0.01 && dash < 0.35 && Math.abs(offset) < 0.005
    )
    await expectPhase(example, (dash, offset) => dash > 0.9 && Math.abs(offset) < 0.02)
    await expectPhase(example, (dash, offset) => dash < 0.8 && offset < -0.2)
    await expectRange(example, 0.65)
})

test('Reset interrupts Replay and stays reset through the old sequence deadline', async ({
    page
}) => {
    const example = await openDemo(page)
    await example.getByRole('button', { name: 'Replay', exact: true }).click()
    await expectPhase(
        example,
        (dash, offset) => dash > 0.01 && dash < 0.35 && Math.abs(offset) < 0.005
    )
    await example.getByRole('button', { name: 'Reset', exact: true }).click()
    await expectRange(example, 0.65)

    // Continuously sample beyond the old 3.2 s sequence, so an eventual return
    // to .65 cannot hide a Replay that kept running after Reset.
    const resetAt = Date.now()
    let drifted = false
    await expect
        .poll(
            async () => {
                const current = await strokes(example)
                drifted ||=
                    current.length !== 2 ||
                    current.some(
                        ({ dash, offset, width }, index) =>
                            dash.length !== 2 ||
                            ![...dash, offset, width].every(Number.isFinite) ||
                            Math.abs(dash[0] - 0.65) > 0.005 ||
                            Math.abs(dash[1] - 1) > 0.005 ||
                            Math.abs(offset) > 0.005 ||
                            width !== [16, 4][index]
                    )
                return { stable: !drifted, observedPastDeadline: Date.now() - resetAt >= 3300 }
            },
            { timeout: 5000, intervals: [50] }
        )
        .toEqual({ stable: true, observedPastDeadline: true })
})

test.describe('reduced motion', () => {
    test('Replay immediately restores the initial segment from an erased state', async ({
        page
    }) => {
        // Top-level test.use({ reducedMotion }) is not a Playwright fixture.
        // Set the browser preference explicitly before the component mounts.
        await page.emulateMedia({ reducedMotion: 'reduce' })
        const example = await openDemo(page)
        expect(
            await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
        ).toBe(true)
        await expect(example.getByText('Reduced motion: changes apply immediately.')).toBeVisible()
        await example.getByRole('button', { name: 'Erase', exact: true }).click()
        await expectRange(example, 0, 0, 500)
        await example.getByRole('button', { name: 'Replay', exact: true }).click()
        await expectRange(example, 0.65, 0, 500)
    })
})
