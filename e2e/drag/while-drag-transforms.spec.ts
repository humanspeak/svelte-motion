import { expect, test, type Locator, type Page } from '@playwright/test'

const URL = '/tests/drag/while-drag-transforms?@isPlaywright=true'

const nextFrame = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

const beginHorizontalDrag = async (page: Page, card: Locator) => {
    await card.waitFor({ state: 'visible' })
    await card.scrollIntoViewIfNeeded()
    const box = await card.boundingBox()
    if (!box) throw new Error('missing drag-card bounds')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 56, y, { steps: 6 })
    return { x, y }
}

const sampleFrames = async <T>(page: Page, read: () => Promise<T>, count = 8) => {
    const samples: T[] = []
    for (let frame = 0; frame < count; frame++) {
        await nextFrame(page)
        samples.push(await read())
    }
    return samples
}

const readRotation = (card: Locator) =>
    card.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
    })

test.describe('drag/whileDrag transform composition', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('rotate-card').waitFor({ state: 'visible' })
    })

    test('keeps whileDrag rotation composed across live drag frames', async ({ page }) => {
        const card = page.getByTestId('rotate-card')
        await beginHorizontalDrag(page, card)

        try {
            await page.waitForTimeout(120)
            const rotations = await sampleFrames(page, () => readRotation(card))

            expect(rotations).toHaveLength(8)
            expect(
                rotations.every((degrees) => Math.abs(degrees - 8) < 1.5),
                `sampled rotations: ${rotations.join(', ')}`
            ).toBe(true)
        } finally {
            await page.mouse.up()
        }
    })

    test('keeps an x-only drag pinned on y when its layout slot moves', async ({ page }) => {
        const card = page.getByTestId('cross-axis-card')
        await beginHorizontalDrag(page, card)

        try {
            const before = await card.boundingBox()
            if (!before) throw new Error('missing pre-insertion card bounds')

            await page
                .getByTestId('insert-above')
                .evaluate((button: HTMLButtonElement) => button.click())
            const ySamples = await sampleFrames(page, async () => {
                const box = await card.boundingBox()
                if (!box) throw new Error('missing post-insertion card bounds')
                return box.y
            })

            const maxDrift = Math.max(...ySamples.map((y) => Math.abs(y - before.y)))
            expect(maxDrift).toBeLessThanOrEqual(2)
        } finally {
            await page.mouse.up()
        }
    })

    test('keeps a whileDrag override composed with an authored style channel', async ({ page }) => {
        const card = page.getByTestId('authored-rotate-card')
        const start = await beginHorizontalDrag(page, card)

        try {
            await page.waitForTimeout(120)
            const samples = await sampleFrames(page, () =>
                card.evaluate((element) => {
                    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
                    return {
                        degrees: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
                        translateX: matrix.m41
                    }
                })
            )

            expect(samples).toHaveLength(8)

            // whileDrag must win the channel that `style` also authors (-8deg -> 4deg).
            expect(
                samples.every(({ degrees }) => Math.abs(degrees - 4) < 1.5),
                `sampled rotations: ${samples.map(({ degrees }) => degrees.toFixed(2)).join(', ')}`
            ).toBe(true)

            // ...and the drag translation must still be composed into the same transform.
            expect(
                samples.every(({ translateX }) => translateX > 40),
                `sampled translateX: ${samples.map(({ translateX }) => translateX.toFixed(1)).join(', ')}`
            ).toBe(true)

            const box = await card.boundingBox()
            if (!box) throw new Error('missing dragged card bounds')
            expect(box.x).toBeGreaterThan(start.x - box.width / 2 + 40)
        } finally {
            await page.mouse.up()
        }
    })

    test('drags under the full gesture stack over authored transform channels', async ({
        page
    }) => {
        const card = page.getByTestId('gesture-stack-card')
        const before = await card.boundingBox()
        if (!before) throw new Error('missing pre-drag card bounds')

        await beginHorizontalDrag(page, card)

        try {
            await page.waitForTimeout(120)
            const samples = await sampleFrames(page, () =>
                card.evaluate((element) => {
                    const raw = getComputedStyle(element).transform
                    const matrix = new DOMMatrixReadOnly(raw)
                    return {
                        raw,
                        degrees: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
                        translateX: matrix.m41
                    }
                })
            )

            expect(samples).toHaveLength(8)

            // The composed transform must never collapse to `none`.
            expect(
                samples.every(({ raw }) => raw !== 'none'),
                `sampled transforms: ${samples.map(({ raw }) => raw).join(' | ')}`
            ).toBe(true)

            // The drag translation must be painted.
            expect(
                samples.every(({ translateX }) => translateX > 40),
                `sampled translateX: ${samples.map(({ translateX }) => translateX.toFixed(1)).join(', ')}`
            ).toBe(true)

            // whileDrag must win the rotate channel that `style` also authors.
            expect(
                samples.every(({ degrees }) => Math.abs(degrees - 4) < 2),
                `sampled rotations: ${samples.map(({ degrees }) => degrees.toFixed(2)).join(', ')}`
            ).toBe(true)

            // And the element must have actually moved on screen.
            const during = await card.boundingBox()
            if (!during) throw new Error('missing mid-drag card bounds')
            expect(during.x - before.x).toBeGreaterThan(40)
        } finally {
            await page.mouse.up()
        }
    })

    test('release restores the authored rotate smoothly, without a settle-then-snap', async ({
        page
    }) => {
        const card = page.getByTestId('gesture-stack-card')
        await beginHorizontalDrag(page, card)
        await page.waitForTimeout(120)
        await page.mouse.up()

        const samples = await sampleFrames(page, () => readRotation(card), 45)

        // The restore must be continuous: a settle-to-neutral followed by a
        // snap to the authored angle shows up as a large single-frame jump.
        const maxJump = Math.max(...samples.slice(1).map((deg, i) => Math.abs(deg - samples[i])))
        expect(
            maxJump,
            `max single-frame rotation jump: ${maxJump.toFixed(2)}deg — samples: ${samples
                .map((d) => d.toFixed(1))
                .join(', ')}`
        ).toBeLessThan(4)

        // And it must settle on the style-authored angle, not neutral.
        const settled = samples.at(-1)!
        expect(
            Math.abs(settled - -8),
            `settled rotation: ${settled.toFixed(2)}deg (authored -8deg)`
        ).toBeLessThan(1.5)
    })

    test('keeps rotateX composed with perspective across live drag frames', async ({ page }) => {
        const card = page.getByTestId('rotate-x-card')
        await beginHorizontalDrag(page, card)

        try {
            await page.waitForTimeout(120)
            const rotateXTerms = await sampleFrames(page, () =>
                card.evaluate((element) => {
                    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
                    return {
                        is2D: matrix.is2D,
                        m23: Math.abs(matrix.m23)
                    }
                })
            )

            expect(rotateXTerms).toHaveLength(8)
            expect(rotateXTerms.every(({ is2D }) => !is2D)).toBe(true)
            expect(
                rotateXTerms.every(({ m23 }) => m23 > 0.35),
                `sampled m23 terms: ${rotateXTerms.map(({ m23 }) => m23).join(', ')}`
            ).toBe(true)
        } finally {
            await page.mouse.up()
        }
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'Drag: whileDrag transform composition' })
        ).toHaveAttribute('href', /\/tests\/drag\/while-drag-transforms/)
    })
})
