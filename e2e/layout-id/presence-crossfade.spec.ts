import { expect, test, type Page } from '@playwright/test'
import { pixelsAt, recordPainted, regionsIn, type Rgb } from '../_helpers/paintedFrames'

/**
 * Plan 012. Page: src/routes/tests/layout-id/presence-crossfade/+page.svelte,
 * a port of upstream motion `dev/react/src/tests/layout-shared-animate-presence.tsx`
 * @ v14.7.1.
 *
 * An exiting `layoutId` element is held until the new lead's shared animation
 * completes, even without an `exit`, follows the new element and crossfades
 * out (`MeasureLayout.tsx:188-201` relegate, `PresenceChild.tsx:67-75`).
 */

const URL = '/tests/layout-id/presence-crossfade?@isPlaywright=true'

async function open(page: Page, query = '') {
    await page.setViewportSize({ width: 1000, height: 660 })
    await page.goto(URL + query)
    await expect(page.locator('[data-hydrated]')).toBeAttached()
}

for (const [suffix, query] of [
    ['', ''],
    [' (owned)', '&owned=true']
] as const) {
    /**
     * Verbatim port of `packages/framer-motion/cypress/integration/layout-shared.ts`
     * @ v14.7.1, 65-86.
     */
    test(`When performing crossfade animation, removed element isn't removed until animation is complete${suffix}`, async ({
        page
    }) => {
        await open(page, query)
        await page.waitForTimeout(50)
        expect(
            await page.locator('#shape-0').evaluate((el) => (el as HTMLElement).style.opacity)
        ).toBe('1')
        await page.locator('#shape-0').click()
        await page.waitForTimeout(50)
        // Lose reference to original element
        await expect(page.locator('#shape-1')).toBeAttached()
        expect(await page.locator('#shape-0').count()).toBe(1)
        expect(
            await page.locator('#shape-0').evaluate((el) => (el as HTMLElement).style.opacity)
        ).toBe('1')
        expect(
            await page.locator('#shape-1').evaluate((el) => (el as HTMLElement).style.opacity)
        ).toBe('0.433013')
    })
}

/**
 * Plan 012 A1: the held shape is released when the shared animation ends, as
 * upstream removes it (gone about 1 s after a 10 s transition in the
 * framer-motion 14.7.1 repro). `?duration=1` shortens only the transition.
 */
async function expectReleased(page: Page, clickedAt: number, duration = 1) {
    await expect
        .poll(() => page.locator('#shape-0').count(), { timeout: (duration + 1) * 1000 })
        .toBe(0)
    const at = await page.evaluate(() => performance.now())
    // Not before the animation ended.
    expect(at - clickedAt).toBeGreaterThan(duration * 1000 - 50)
}

for (const [suffix, query] of [
    ['', ''],
    [' (owned)', '&owned=true']
] as const) {
    test(`the held shape is released once the shared animation ends${suffix}`, async ({ page }) => {
        await open(page, `${query}&duration=1`)
        await page.waitForTimeout(100)
        const clickedAt = await page.evaluate(() => performance.now())
        await page.locator('#shape-0').click()
        await page.waitForTimeout(500)
        expect(await page.locator('#shape-0').count(), 'held mid-animation').toBe(1)
        await expectReleased(page, clickedAt)
    })
}

/** The centre pixel of the shape `?solo=<n>` paints at rest (a still page: a screenshot). */
async function soloColour(page: Page, n: number): Promise<Rgb> {
    await open(page, `&solo=${n}`)
    await page.waitForTimeout(200)
    const centre = await page.evaluate((n) => {
        const r = document.getElementById(`shape-${n}`)!.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }, n)
    const data = (await page.screenshot()).toString('base64')
    const pixels = await pixelsAt(page, [{ t: 0, data, deviceWidth: 1000 }], [centre])
    return pixels[0][0]
}

const differsFrom = (a: Rgb, b: Rgb) => a.some((channel, i) => Math.abs(channel - b[i]) >= 20)

/** Screencast frames further apart than this are a capture gap (015a A1). */
const CAPTURE_GAP_MS = 50

for (const [suffix, query] of [
    ['', ''],
    [' (owned)', '&owned=true']
] as const) {
    test(`painted frames: the held shape sits on the new one, both painted, every frame${suffix}`, async ({
        page
    }) => {
        const blue = await soloColour(page, 0)
        const purple = await soloColour(page, 1)

        await open(page, `${query}&duration=1`)
        await page.waitForTimeout(200)
        const clickedAt = await page.evaluate(() => performance.now())
        const zBefore = await page.locator('#shape-0').evaluate((el) => getComputedStyle(el).zIndex)

        const recording = await recordPainted(
            page,
            () => page.locator('#shape-0').click(),
            700,
            [{ selector: '#shape-1' }],
            ['#shape-1', '#shape-0']
        )

        // Precondition (M2): no z-index lift on the held shape, and the new
        // shape paints on top, as upstream renders the exiting child first
        // (`AnimatePresence/index.tsx:155-164`).
        const zHeld = await page.locator('#shape-0').evaluate((el) => getComputedStyle(el).zIndex)
        expect(zHeld).toBe(zBefore)
        const judged = recording.hits.filter((hit) => hit.t >= 100)
        expect(judged.length).toBeGreaterThan(10)
        for (const hit of judged) {
            expect(hit.counts[1], `#shape-0 held at ${hit.t.toFixed(0)}ms`).toBe(1)
            expect(hit.hits[0], `hit at ${hit.t.toFixed(0)}ms`).toBe('shape-1')
        }

        // The crossfade is frozen (`ease: () => 0.25`), so the compositor may
        // paint only once after the click: the rAF hits cover the rest.
        const frames = recording.frames.filter((frame) => frame.t >= 100)
        expect(frames.length).toBeGreaterThanOrEqual(1)
        const regions = await regionsIn(
            page,
            frames,
            { left: 0, top: 0, width: 1000, height: 660 },
            [255, 255, 255]
        )
        // The new shape's painted centre, from the rAF frame nearest each
        // screencast frame.
        const centres = frames.map((frame) => {
            const nearest = recording.hits.reduce((best, hit) =>
                Math.abs(hit.t - frame.t) < Math.abs(best.t - frame.t) ? hit : best
            )
            const rect = nearest.rects[0]!
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        })
        const centrePixels = await Promise.all(
            frames.map((frame, i) => pixelsAt(page, [frame], [centres[i]]))
        )
        for (let i = 0; i < frames.length; i++) {
            const at = `frame at ${frames[i].t.toFixed(0)}ms`
            expect(regions[i].length, `${at}: one painted region`).toBe(1)
            const pixel = centrePixels[i][0][0]
            expect(
                differsFrom(pixel, blue),
                `${at}: ${pixel.join(',')} vs blue ${blue.join(',')}`
            ).toBe(true)
            expect(
                differsFrom(pixel, purple),
                `${at}: ${pixel.join(',')} vs purple ${purple.join(',')}`
            ).toBe(true)
        }
        // Across a capture gap, the rAF hits stand in for the screencast.
        for (let i = 1; i < frames.length; i++) {
            if (frames[i].t - frames[i - 1].t <= CAPTURE_GAP_MS) continue
            const inGap = judged.filter((hit) => hit.t > frames[i - 1].t && hit.t < frames[i].t)
            expect(inGap.length, `rAF hits across the gap before ${frames[i].t}ms`).toBeGreaterThan(
                0
            )
        }
        // A1: released once the 1 s shared animation ends.
        await expectReleased(page, clickedAt)
    })
}
