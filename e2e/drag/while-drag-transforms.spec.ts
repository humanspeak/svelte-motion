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
            const rotations = await sampleFrames(page, () =>
                card.evaluate((element) => {
                    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
                    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
                })
            )

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
