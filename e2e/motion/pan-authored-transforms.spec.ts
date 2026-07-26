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

    /**
     * Characterization pin added BEFORE whilePan moved onto the VisualElement
     * (drag-single-writer 004). The two specs above only exercise a channel the
     * element authors on `style`; the restore path's real risk is keys whilePan
     * INTRODUCES — an animatable one over an `animate` value, and a
     * non-animatable inline one — because the pre-pan value for those has to be
     * recovered from the node rather than read off the authored props.
     */
    test('restores whilePan keys the element never authored', async ({ page }) => {
        const card = page.getByTestId('pan-unauthored-keys-card')
        await card.scrollIntoViewIfNeeded()
        const readState = () =>
            card.evaluate((element) => ({
                opacity: Number.parseFloat(getComputedStyle(element).opacity),
                cursor: getComputedStyle(element).cursor
            }))

        await expect
            .poll(async () => (await readState()).opacity, { timeout: 2000 })
            .toBeCloseTo(0.9, 1)
        const authored = await readState()
        expect(authored.cursor).not.toBe('grabbing')

        await beginPan(page, card)
        try {
            await expect
                .poll(async () => (await readState()).opacity, { timeout: 2000 })
                .toBeLessThan(0.6)
            expect((await readState()).cursor).toBe('grabbing')
        } finally {
            await page.mouse.up()
        }

        // Pan end reverts BOTH: opacity back to the animate target, cursor back
        // to what it was before the gesture.
        await expect
            .poll(async () => (await readState()).opacity, { timeout: 2000 })
            .toBeCloseTo(0.9, 1)
        expect((await readState()).cursor).toBe(authored.cursor)
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'Pan: whilePan over authored transforms' })
        ).toHaveAttribute('href', /\/tests\/motion\/pan-authored-transforms/)
    })
})
