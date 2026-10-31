import { expect, test, type Page } from '@playwright/test'
import { recordPainted } from '../_helpers/paintedFrames'

/**
 * Port of upstream motion `tests/react/issue-1411-open-change.spec.ts` @
 * v14.7.1 (https://github.com/motiondivision/motion/issues/1411, Motion
 * 14.7.1).
 *
 * A gallery's thumbnails have layoutId={id} and a persistent detail card has
 * layoutId={open}. With "one" open, "Next" changes the card's layoutId to
 * "two". The card should switch instantly, staying where it is. Thumbnail one
 * should reappear, animating home from the card's box (not from thumbnail
 * two's), and thumbnail two should disappear, as the card now leads its
 * layoutId. Closing then shrinks the card into thumbnail two.
 *
 * The page records every frame with a rAF loop, so these are the frames the
 * browser painted, not samples taken by the test.
 *
 * Deviations: upstream's first test is split in two (the switch, then the
 * close), and the `?strict=true` variant is dropped (no StrictMode in Svelte).
 */

interface Box {
    x: number
    y: number
    width: number
    height: number
    opacity: number
    visibility: string
}
type Frame = Record<'one' | 'two' | 'card', Box>

const URL = '/tests/layout-id/open-change?@isPlaywright=true'

const near = (a: Box, b: Box, tolerance: number) =>
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.width - b.width) < tolerance &&
    Math.abs(a.height - b.height) < tolerance

const isHidden = (box: Box) => box.visibility === 'hidden' || box.opacity < 0.01

async function framesSince(page: Page, key: string): Promise<Frame[]> {
    return page.evaluate((key) => {
        const w = window as unknown as Record<string, unknown> & { frames: Frame[] }
        return w.frames.slice((w[key] as number) - 1)
    }, key)
}

/** Opens "one", lets the 2s opening animation finish, then clicks "Next". */
async function openThenNext(page: Page, query = '') {
    await page.goto(URL + query)
    await expect(page.locator('#one')).toBeVisible()
    await page.waitForTimeout(200)
    await page.click('#one')
    // Let the 2s opening animation finish
    await page.waitForTimeout(2500)
    await page.click('#next')
    // ~25% into the 2s animation home
    await page.waitForTimeout(500)
    return framesSince(page, 'changedAt')
}

test("changing an open card's layoutId switches it instantly", async ({ page }) => {
    const [before, ...after] = await openThenNext(page)
    const { card } = before
    expect(after.length).toBeGreaterThan(10)

    // The card stays where it is, fully opaque: no re-grow, no crossfade
    expect.soft(after.filter((frame) => !near(frame.card, card, 2))).toEqual([])
    expect.soft(after.filter((frame) => frame.card.opacity < 0.99)).toEqual([])

    // Thumbnail one starts from the card's box, not thumbnail two's
    const first = after.find((frame) => !isHidden(frame.one) && !near(frame.one, card, 1))!
    expect(first).toBeDefined()
    expect.soft(first.one, 'starts at the card').toMatchObject({
        x: expect.closeTo(card.x, -2),
        y: expect.closeTo(card.y, -2),
        width: expect.closeTo(card.width, -2),
        height: expect.closeTo(card.height, -2)
    })
    // ...and is on its way home
    const last = after[after.length - 1]
    expect(last.one.width).toBeLessThan(first.one.width - 20)
    expect(last.one.width).toBeGreaterThan(160)
    expect(isHidden(last.one)).toBe(false)

    // Thumbnail two disappears once the card leads its layoutId
    expect.soft(after.slice(2).filter((frame) => !isHidden(frame.two))).toEqual([])
})

/**
 * Closing runs on the clone path and on the owned path (`?owned=true`:
 * `present` + `child`), plan 012.
 */
for (const [suffix, query] of [
    ['', ''],
    [' (owned)', '&owned=true']
] as const) {
    test(`closing then shrinks the card into thumbnail two${suffix}`, async ({ page }) => {
        const [before] = await openThenNext(page, query)
        const { card, two } = before

        // Closing shrinks the card into thumbnail two
        await page.waitForTimeout(2000)
        // Plan 012 A1: judged from painted frames too. Upstream the card is
        // held while thumbnail two grows out of it, and crossfades out over
        // the 2s shared animation (`MeasureLayout.tsx:188-201` relegate,
        // `PresenceChild.tsx:67-75`); it is removed only after that ends.
        const { frames, hits } = await recordPainted(
            page,
            () => page.click('#close'),
            2400,
            [],
            ['#card', '#two']
        )
        const closing = await framesSince(page, 'closedAt')
        // ~1s into the 2s animation home (upstream's single sample).
        const mid = closing[Math.min(closing.length - 1, 60)].two
        expect(isHidden(mid)).toBe(false)
        expect(mid.width).toBeLessThan(card.width - 40)
        expect(mid.width).toBeGreaterThan(two.width + 40)

        expect(frames.length).toBeGreaterThan(0)
        // Held for the whole 2s animation (the framer-motion 14.7.1 repro,
        // `src/openchange.tsx`: fully opaque for the first second, then
        // fading to 0 as it lands, gone just after 2s).
        const judged = hits.filter((hit) => hit.t >= 50 && hit.t <= 1900)
        expect(judged.length).toBeGreaterThan(60)
        const opacities: number[] = []
        for (const hit of judged) {
            const at = `${hit.t.toFixed(0)}ms`
            expect(hit.counts[0], `card held at ${at}`).toBe(1)
            expect(hit.visible[1], `thumbnail two painted at ${at}`).toBe(true)
            opacities.push(hit.opacities[0]!)
        }
        // The crossfade: the card fades from 1 towards 0, never back up.
        expect(opacities[0]).toBeGreaterThan(0.8)
        expect(opacities.some((o) => o > 0.1 && o < 0.9)).toBe(true)
        for (let i = 1; i < opacities.length; i++) {
            expect(opacities[i]).toBeLessThanOrEqual(opacities[i - 1] + 0.02)
        }
        // Removed once the 2s animation has ended.
        expect(hits.filter((hit) => hit.t > 2300).every((hit) => hit.counts[0] === 0)).toBe(true)
        await expect.poll(() => page.locator('#card').count(), { timeout: 3000 }).toBe(0)
    })
}

test("changing the card's layoutId mid-open lets it finish opening", async ({ page }) => {
    await page.goto(URL)
    await expect(page.locator('#one')).toBeVisible()
    await page.waitForTimeout(200)
    await page.click('#one')
    // ~25% into the 2s opening animation
    await page.waitForTimeout(500)
    await page.click('#next')
    await page.waitForTimeout(500)
    const [before, ...after] = await framesSince(page, 'changedAt')

    // The card keeps growing towards its box, rather than freezing
    const last = after[after.length - 1]
    expect(last.card.width).toBeGreaterThan(before.card.width + 40)
    expect(isHidden(last.card)).toBe(false)
    // Thumbnail one heads home from where the card was
    expect(last.one.width).toBeLessThan(before.card.width)
    expect(isHidden(last.one)).toBe(false)
    expect(isHidden(last.two)).toBe(true)

    // ...and the card ends up open in its box
    await page.waitForTimeout(1500)
    // Upstream samples once here. Thumbnail one's 2s tween starts at the
    // "Next" click, so that sample lands on its last frame: under load one
    // late frame leaves it a fraction of a pixel short. Poll briefly until it
    // has finished; the expected sizes are unchanged.
    await expect
        .poll(
            () =>
                page.evaluate(() =>
                    ['card', 'one'].map((id) => {
                        const element = document.getElementById(id)!
                        const { width, height } = element.getBoundingClientRect()
                        return {
                            width: width - element.offsetWidth,
                            height: height - element.offsetHeight
                        }
                    })
                ),
            { timeout: 1000 }
        )
        .toEqual([
            { width: 0, height: 0 },
            { width: 0, height: 0 }
        ])
})
