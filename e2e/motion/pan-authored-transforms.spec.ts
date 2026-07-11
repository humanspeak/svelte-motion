import { expect, test, type Locator, type Page } from '@playwright/test'

const URL = '/tests/motion/pan-authored-transforms?@isPlaywright=true'

const nextFrame = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

const readRotation = (card: Locator) =>
    card.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
    })

const sampleRotations = async (page: Page, card: Locator, count: number) => {
    const samples: number[] = []
    for (let frame = 0; frame < count; frame++) {
        await nextFrame(page)
        samples.push(await readRotation(card))
    }
    return samples
}

const beginPan = async (page: Page, card: Locator) => {
    await card.waitFor({ state: 'visible' })
    await card.scrollIntoViewIfNeeded()
    const box = await card.boundingBox()
    if (!box) throw new Error('missing pan-card bounds')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 56, y, { steps: 6 })
}

test.describe('motion/whilePan over authored transforms', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('pan-authored-rotate-card').waitFor({ state: 'visible' })
    })

    test('pan-start animates the authored rotate to the whilePan value', async ({ page }) => {
        const card = page.getByTestId('pan-authored-rotate-card')

        expect(Math.abs((await readRotation(card)) - -8)).toBeLessThan(1)

        await beginPan(page, card)
        try {
            await page.waitForTimeout(600)
            const panning = await readRotation(card)
            expect(
                Math.abs(panning - 4),
                `panning rotation: ${panning.toFixed(2)}deg`
            ).toBeLessThan(1.5)
        } finally {
            await page.mouse.up()
        }
    })

    test('pan-end restores the authored rotate smoothly, without a settle-then-snap', async ({
        page
    }) => {
        const card = page.getByTestId('pan-authored-rotate-card')
        await beginPan(page, card)
        await page.waitForTimeout(600)
        await page.mouse.up()

        const samples = await sampleRotations(page, card, 45)

        // The restore must be continuous: settling to neutral and then
        // snapping to the authored angle shows up as a single-frame jump.
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

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'Pan: whilePan over authored transforms' })
        ).toHaveAttribute('href', /\/tests\/motion\/pan-authored-transforms/)
    })
})
