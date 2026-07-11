import { expect, test } from '@playwright/test'
import { beginHorizontalDrag as beginPan, readRotation, sampleFrames } from '../_helpers/transform'

const URL = '/tests/motion/pan-authored-transforms?@isPlaywright=true'

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

        const samples = await sampleFrames(page, () => readRotation(card), 45)

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
