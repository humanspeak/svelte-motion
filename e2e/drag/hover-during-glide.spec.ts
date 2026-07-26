import { expect, test, type Page } from '@playwright/test'

/**
 * The operator's #449 acceptance criterion, recorded during live sign-off:
 * hover MUST respond during the post-release momentum glide.
 *
 * Upstream framer-motion holds its global drag lock only while the pointer is
 * down (`VisualElementDragControls.cancel()` releases it from `stop()`), so a
 * pointer entering the element mid-glide starts `whileHover` at once and the
 * hover scale composes with the in-flight translate. This library suppressed
 * hover until the glide had fully settled — visible in review as a card that
 * refuses to react while it is still travelling.
 *
 * Both halves matter, so both are asserted: hover must engage (scale rises) AND
 * the glide must keep travelling through it (a snap would mean two writers are
 * fighting over the transform).
 */

const URL = '/tests/drag/hover-during-glide?@isPlaywright=true'

/** translateX + uniform scale, decomposed from the live computed matrix. */
const readState = (page: Page) =>
    page.evaluate(() => {
        const element = document.querySelector<HTMLElement>('[data-testid="glide-card"]')
        if (!element) return { tx: 0, scale: 1 }
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return { tx: matrix.m41, scale: Math.hypot(matrix.a, matrix.b) }
    })

test.describe('drag/hover-during-glide', () => {
    test('hover engages mid-glide and the glide keeps travelling', async ({ page }) => {
        await page.goto(URL)
        const card = page.getByTestId('glide-card')
        await card.waitFor({ state: 'visible' })

        const box = await card.boundingBox()
        if (!box) throw new Error('no bbox')
        const cy = box.y + box.height / 2
        const startX = box.x + box.width / 2

        // Flick right and release with velocity.
        await page.mouse.move(startX, cy)
        await page.mouse.down()
        for (let step = 1; step <= 6; step++) {
            await page.mouse.move(startX + step * 45, cy)
        }
        await page.mouse.up()

        // Leave the card so `whileHover` is definitively OFF before the
        // measurement: the flick starts with the pointer over the card (hover
        // engaged before the drag and survives the release, as upstream), so
        // without this the test would pass vacuously on the old hover.
        await page.mouse.move(startX, cy - 140)
        let left = await readState(page)
        for (let attempt = 0; attempt < 25 && left.scale >= 1.05; attempt++) {
            await page.waitForTimeout(40)
            left = await readState(page)
        }
        expect(
            left.scale,
            `hover must have released before the measurement (scale ${left.scale.toFixed(3)})`
        ).toBeLessThan(1.05)
        // The glide must still be in flight, or there is nothing to measure.
        await page.waitForTimeout(60)
        const stillMoving = await readState(page)
        expect(
            Math.abs(stillMoving.tx - left.tx),
            `glide travelled ${Math.abs(stillMoving.tx - left.tx).toFixed(2)}px while the pointer was away`
        ).toBeGreaterThan(2)

        // Re-enter the card at its CURRENT position, mid-glide.
        const midBox = await card.boundingBox()
        if (!midBox) throw new Error('no mid bbox')
        await page.mouse.move(midBox.x + midBox.width / 2, midBox.y + midBox.height / 2)

        // Sample the next frames: hover must engage while the glide continues.
        const samples: Array<{ tx: number; scale: number }> = []
        for (let frame = 0; frame < 30; frame++) {
            samples.push(await readState(page))
            await page.evaluate(() => new Promise(requestAnimationFrame))
        }

        const peakScale = Math.max(...samples.map((sample) => sample.scale))
        expect(
            peakScale,
            `peak scale ${peakScale.toFixed(3)} during the glide (whileHover targets 1.3)`
        ).toBeGreaterThan(1.1)

        // The glide is uninterrupted: it kept travelling in the same direction
        // after hover engaged, and never snapped backwards.
        const hoverIndex = samples.findIndex((sample) => sample.scale > 1.05)
        expect(hoverIndex, 'hover engaged within the sampled window').toBeGreaterThanOrEqual(0)
        const travelAfterHover = samples[samples.length - 1].tx - samples[hoverIndex].tx
        expect(
            travelAfterHover,
            `travelled ${travelAfterHover.toFixed(2)}px after hover engaged`
        ).toBeGreaterThan(0)
        for (let index = 1; index < samples.length; index++) {
            expect(
                samples[index].tx,
                `sample ${index} snapped backwards: ${samples[index - 1].tx.toFixed(2)} -> ${samples[index].tx.toFixed(2)}`
            ).toBeGreaterThan(samples[index - 1].tx - 1)
        }
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.locator('a[href*="/tests/drag/hover-during-glide"]').first()
        ).toBeVisible()
    })
})
