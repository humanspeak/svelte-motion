import { expect, test, type Locator } from '@playwright/test'

const URL = '/tests/motion/tap-authored-transforms?@isPlaywright=true'

const readCenter = async (locator: Locator): Promise<{ x: number; y: number }> => {
    const box = await locator.boundingBox()
    if (!box) throw new Error('button has no bounding box')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('motion/whileTap over authored transforms', () => {
    test('press and release keep a translate-centered element centered', async ({ page }) => {
        await page.goto(URL)
        const button = page.getByTestId('tap-authored-center-button')
        await button.waitFor({ state: 'visible' })
        await page.waitForTimeout(800)

        const resting = await readCenter(button)

        // Hover composes with the authored translate (covered elsewhere) —
        // capture the center as the reference for the press phases.
        await button.hover()
        await page.waitForTimeout(500)
        const hovered = await readCenter(button)
        expect(
            Math.hypot(hovered.x - resting.x, hovered.y - resting.y),
            'hover must scale about the centered position'
        ).toBeLessThan(3)

        // Press: the tap scale must compose with the authored translate.
        // Losing it shifts the element by half its size (~90px horizontally).
        await page.mouse.down()
        await page.waitForTimeout(400)
        const pressed = await readCenter(button)
        expect(
            Math.hypot(pressed.x - resting.x, pressed.y - resting.y),
            'press must scale about the centered position, not jump'
        ).toBeLessThan(3)

        // Release: same contract on the way back.
        await page.mouse.up()
        await page.waitForTimeout(500)
        const released = await readCenter(button)
        expect(
            Math.hypot(released.x - resting.x, released.y - resting.y),
            'release must return to the centered position'
        ).toBeLessThan(3)
    })
})
