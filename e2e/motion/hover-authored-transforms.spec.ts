import { expect, test } from '@playwright/test'
import { readRotation, sampleFrames } from '../_helpers/transform'

const URL = '/tests/motion/hover-authored-transforms?@isPlaywright=true'

test.describe('motion/whileHover over authored transforms', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('hover-authored-rotate-card').waitFor({ state: 'visible' })
    })

    test('hover-enter animates the authored rotate to the whileHover value', async ({ page }) => {
        const card = page.getByTestId('hover-authored-rotate-card')

        expect(Math.abs((await readRotation(card)) - -8)).toBeLessThan(1)

        await card.hover()
        await page.waitForTimeout(600)

        const hovered = await readRotation(card)
        expect(Math.abs(hovered - 4), `hovered rotation: ${hovered.toFixed(2)}deg`).toBeLessThan(
            1.5
        )
    })

    test('hover-leave restores the authored rotate smoothly, without a settle-then-snap', async ({
        page
    }) => {
        const card = page.getByTestId('hover-authored-rotate-card')
        await card.hover()
        await page.waitForTimeout(600)

        // Leave: move the pointer well away from the card.
        await page.mouse.move(4, 4)

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
            page.getByRole('link', { name: 'Hover: whileHover over authored transforms' })
        ).toHaveAttribute('href', /\/tests\/motion\/hover-authored-transforms/)
    })
})
