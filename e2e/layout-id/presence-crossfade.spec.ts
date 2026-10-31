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
        const after = recording.frames.filter((frame) => frame.t >= 100)
        // With nothing repainted after 100ms, the last frame painted before
        // it is what is on screen.
        const frames = after.length ? after : recording.frames.slice(-1)
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

/**
 * Plan 012, Step 3d (placement, M1): a held exit clone is drawn exactly where
 * its element was. Its re-homed VisualElement renders the element's
 * transforms and `style` motion values onto it, so the clone takes the
 * untransformed box, from the recorded computed style and the placeholder
 * slot (in flow) or its own resolved insets (out of flow). Judged on every
 * rAF frame until the clone is gone.
 */
test.describe('held clone placement (plan 012, 3d)', () => {
    type Box = { left: number; top: number; width: number; height: number }
    const near = (a: Box, b: Box, tolerance = 1) =>
        Math.abs(a.left - b.left) <= tolerance &&
        Math.abs(a.top - b.top) <= tolerance &&
        Math.abs(a.width - b.width) <= tolerance &&
        Math.abs(a.height - b.height) <= tolerance

    /** Remove the probe after `delay` ms; frames split at the clone's appearance. */
    async function removeProbe(page: Page, probe: string, delay: number, scrollY = 0) {
        await page.setViewportSize({ width: 1000, height: 660 })
        await page.goto(`${URL}&probe=${probe}`)
        await expect(page.locator('[data-hydrated]')).toBeAttached()
        if (scrollY) await page.evaluate((y) => window.scrollTo(0, y), scrollY)
        const { hits } = await recordPainted(
            page,
            async () => {
                await page.waitForTimeout(delay)
                await page.locator('#remove-probe').click()
            },
            1400,
            [],
            ['#probe', '#control', '[data-clone]']
        )
        const firstClone = hits.findIndex((hit) => hit.counts[2] > 0)
        expect(firstClone, 'a clone appeared').toBeGreaterThan(0)
        const before = hits[firstClone - 1]
        const held = hits.slice(firstClone).filter((hit) => hit.counts[2] > 0)
        expect(held.length).toBeGreaterThan(20)
        return { before, held }
    }

    test('3d-i: an exit interrupting its enter keeps tracking the enter, no jump', async ({
        page
    }) => {
        const { before, held } = await removeProbe(page, 'enter', 300)
        const distance = before.rects[1]!.left - before.rects[0]!.left
        // From the first frame after the removal on (no jump, no doubled
        // `x` or `scale`), the clone moves exactly with the control.
        for (const hit of held) {
            const clone = hit.rects[0]!
            const control = hit.rects[1]!
            expect(
                near(clone, { ...control, left: control.left - distance }, 0.5),
                `at ${hit.t.toFixed(0)}ms: clone ${JSON.stringify(clone)} control ${JSON.stringify(control)}`
            ).toBe(true)
        }
    })

    for (const [name, probe, scrollY] of [
        ['3d-ii: out of flow, with style layout keys', 'styles', 0],
        [
            '3d-iii: in flow with a margin, initial containing block, page scrolled 200px',
            'margin',
            200
        ],
        ['3d-iv: in flow, style motion values and content-box', 'values', 0],
        ['3d-v: absolute inside a transform containing block', 'transform', 0],
        ['3d-v: fixed inside a filter containing block', 'filter', 0],
        ['3d-v: fixed inside a backdrop-filter containing block', 'backdrop', 0]
    ] as const) {
        test(`${name}: the clone stays on the element's last painted box`, async ({ page }) => {
            const { before, held } = await removeProbe(page, probe, 200, scrollY)
            for (const hit of held) {
                expect(
                    near(hit.rects[0]!, before.rects[0]!),
                    `at ${hit.t.toFixed(0)}ms: ${JSON.stringify(hit.rects[0])} vs ${JSON.stringify(before.rects[0])}`
                ).toBe(true)
            }
        })
    }
})

/**
 * Plan 012 A3: a `layoutId` shape interrupted mid transform-enter
 * (`scaleX` 0 → 1 over 1 s, linear) by a switch to another slot. In the
 * framer-motion 14.7.1 repro the held shape follows the new one on every
 * frame (the projection owns its transform: `willUpdate` demotes the
 * compositor enter, create-projection-node.ts:129-131, 744-750), the new one
 * starts from where the old one was drawn, and the old one fades out and is
 * removed when the 1 s shared animation ends.
 */
for (const [suffix, query] of [
    ['', ''],
    [' (owned)', '&owned=true']
] as const) {
    test(`a crossfade interrupting a transform enter: the held shape follows the new one${suffix}`, async ({
        page
    }) => {
        await page.setViewportSize({ width: 1000, height: 660 })
        await page.goto(`${URL}&probe=switch${query}`)
        await expect(page.locator('[data-hydrated]')).toBeAttached()
        await page.waitForTimeout(100)
        await page.locator('#start').click()
        // ~40% into the 1 s enter.
        await page.waitForTimeout(400)
        const { frames, hits } = await recordPainted(
            page,
            () => page.locator('#switch').click(),
            1500,
            [],
            ['#shape-a', '#shape-b']
        )
        expect(frames.length).toBeGreaterThan(0)
        const before = hits.filter((hit) => hit.rects[0] && !hit.rects[1])
        const both = hits.filter((hit) => hit.rects[0] && hit.rects[1])
        expect(before.length).toBeGreaterThan(0)
        expect(both.length).toBeGreaterThan(30)
        // The old shape sits on the new one in every frame.
        for (const hit of both) {
            const [a, b] = [hit.rects[0]!, hit.rects[1]!]
            expect(
                Math.abs(a.left - b.left) <= 1 &&
                    Math.abs(a.top - b.top) <= 1 &&
                    Math.abs(a.width - b.width) <= 1,
                `at ${hit.t.toFixed(0)}ms: ${JSON.stringify([a, b])}`
            ).toBe(true)
        }
        // The new one starts where the old one was drawn, mid-enter.
        const last = before[before.length - 1].rects[0]!
        const first = both[0].rects[1]!
        expect(last.width).toBeGreaterThan(40)
        expect(first.width).toBeGreaterThanOrEqual(last.width - 2)
        expect(first.width).toBeLessThanOrEqual(last.width + 20)
        // The old one fades out and goes when the shared animation ends.
        const opacities = both.map((hit) => hit.opacities[0]!)
        for (let i = 1; i < opacities.length; i++) {
            expect(opacities[i]).toBeLessThanOrEqual(opacities[i - 1] + 0.02)
        }
        expect(hits.filter((hit) => hit.t > 1300).every((hit) => !hit.rects[0])).toBe(true)
        const end = hits[hits.length - 1].rects[1]!
        expect(Math.abs(end.left - 500)).toBeLessThanOrEqual(1)
        expect(Math.abs(end.width - 200)).toBeLessThanOrEqual(1)
    })
}
