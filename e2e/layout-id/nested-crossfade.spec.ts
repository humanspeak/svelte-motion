import { expect, test, type Page } from '@playwright/test'
import { recordPainted, type HitFrame, type HitRect } from '../_helpers/paintedFrames'

/**
 * Plan 012, NC1-NC6. Page: src/routes/tests/layout-id/nested-crossfade/+page.svelte
 * (the nested `layoutId` pairs of upstream's `layout-shared-lightbox-crossfade.tsx`
 * @ v14.7.1, in the clone syntax).
 *
 * Upstream every nested node of an exiting child stays mounted with its own
 * `usePresence` (`MeasureLayout.tsx:246-260`), so a nested `layoutId` node
 * relegates and holds like the child itself. A nested `AnimatePresence`
 * isolates its children from the outer exit unless it `propagate`s
 * (`AnimatePresence/index.tsx:213-217`).
 *
 * Painted frames: every `requestAnimationFrame` records the rects and
 * hit-tests (`e2e/_helpers/paintedFrames.ts`), next to a CDP screencast.
 */

const URL = '/tests/layout-id/nested-crossfade?@isPlaywright=true'

type LogEntry = {
    t: number
    fadeOpacity: number | null
    fadeScale: number | null
    cloneConnected: boolean
    innerDone: number
}

async function openLightbox(page: Page, query: string, settleMs: number) {
    await page.setViewportSize({ width: 1000, height: 700 })
    await page.goto(URL + query)
    await expect(page.locator('[data-hydrated]')).toBeAttached()
    await page.waitForTimeout(100)
    await page.locator('#item-parent').click()
    await page.waitForTimeout(settleMs)
}

const centre = (rect: HitRect) => ({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
})
const centresNear = (a: HitRect, b: HitRect, tolerance = 1) => {
    const ca = centre(a)
    const cb = centre(b)
    return Math.abs(ca.x - cb.x) <= tolerance && Math.abs(ca.y - cb.y) <= tolerance
}

const SELECTORS = ['#item-child', '[data-clone] #child', '#item-parent', '[data-clone].lightbox']
const ITEM_CHILD = 0
const CLONE_CHILD = 1
const ITEM_PARENT = 2
const CLONE = 3

async function close(page: Page, ms: number) {
    return recordPainted(
        page,
        () => page.locator('#close').click(),
        ms,
        [{ selector: '#item-child' }],
        SELECTORS
    )
}

/** Frames where the selectors at `a` and `b` are both mounted. */
const both = (hits: HitFrame[], a: number, b: number) =>
    hits.filter((hit) => hit.rects[a] && hit.rects[b])

test('NC1: the nested layoutId copy in the clone follows the gallery dot and crossfades', async ({
    page
}) => {
    await openLightbox(page, '', 1300)
    const { hits } = await close(page, 1400)
    const together = both(hits, ITEM_CHILD, CLONE_CHILD)
    expect(together.length).toBeGreaterThanOrEqual(20)
    for (const hit of together) {
        expect(
            centresNear(hit.rects[CLONE_CHILD]!, hit.rects[ITEM_CHILD]!),
            `at ${hit.t.toFixed(0)}ms: ${JSON.stringify(hit.rects)}`
        ).toBe(true)
    }
    // #item-child grows out of the lightbox dot (150px) into its own (50px)
    const sizes = hits
        .filter((hit) => hit.rects[ITEM_CHILD])
        .map((hit) => hit.rects[ITEM_CHILD]!.width)
    expect(sizes[0]).toBeGreaterThan(130)
    expect(sizes.some((w) => w > 70 && w < 130)).toBe(true)
    expect(sizes[sizes.length - 1]).toBeCloseTo(50, 0)
    for (const hit of hits) expect(hit.hits[0], `hit at ${hit.t.toFixed(0)}ms`).not.toBe('')
})

test('NC2: the outer clone follows the gallery item and crossfades', async ({ page }) => {
    await openLightbox(page, '', 1300)
    const { hits } = await close(page, 1400)
    const together = both(hits, ITEM_PARENT, CLONE)
    expect(together.length).toBeGreaterThanOrEqual(20)
    for (const hit of together) {
        expect(
            centresNear(hit.rects[CLONE]!, hit.rects[ITEM_PARENT]!),
            `at ${hit.t.toFixed(0)}ms: ${JSON.stringify(hit.rects)}`
        ).toBe(true)
    }
    const widths = together.map((hit) => hit.rects[ITEM_PARENT]!.width)
    expect(widths[0]).toBeGreaterThan(400)
    expect(widths.some((w) => w > 200 && w < 400)).toBe(true)
})

test('NC3: inside a nested AnimatePresence the dot stays at its box, then the gallery dot grows from it', async ({
    page
}) => {
    await openLightbox(page, '&inner=boundary', 1300)
    const { hits } = await close(page, 2600)
    const held = hits.filter((hit) => hit.rects[CLONE])
    expect(held.length).toBeGreaterThan(20)
    // While held, the copy stays at its own box (the framer-motion 14.7.1
    // repro paints it fixed at its layout while the card shrinks), and the
    // gallery dot isn't promoted over it.
    const dots = held.filter((hit) => hit.rects[CLONE_CHILD]).map((hit) => hit.rects[CLONE_CHILD]!)
    expect(dots.length).toBeGreaterThan(20)
    for (const dot of dots) {
        expect(Math.abs(dot.left - dots[0].left)).toBeLessThanOrEqual(1)
        expect(Math.abs(dot.top - dots[0].top)).toBeLessThanOrEqual(1)
        expect(Math.abs(dot.width - dots[0].width)).toBeLessThanOrEqual(1)
    }
    for (const hit of held) {
        expect(hit.visible[ITEM_CHILD], `gallery dot hidden at ${hit.t.toFixed(0)}ms`).toBe(false)
    }
    // Released: the copy and the card go together, and the gallery dot
    // animates from the copy's last box.
    const lastHeld = held[held.length - 1]
    const after = hits.filter((hit) => hit.t > lastHeld.t)
    expect(after.length).toBeGreaterThan(10)
    expect(after.every((hit) => !hit.rects[CLONE_CHILD])).toBe(true)
    const first = after.find((hit) => hit.visible[ITEM_CHILD])!
    expect(first).toBeDefined()
    const from = lastHeld.rects[CLONE_CHILD]!
    const at = first.rects[ITEM_CHILD]!
    expect(Math.abs(at.left - from.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(at.top - from.top)).toBeLessThanOrEqual(1)
    expect(Math.abs(at.width - from.width)).toBeLessThanOrEqual(1)
    expect(after[after.length - 1].rects[ITEM_CHILD]!.width).toBeCloseTo(50, 0)
})

test('NC4: inside a propagating AnimatePresence the dot relegates and crossfades like NC1', async ({
    page
}) => {
    await openLightbox(page, '&inner=propagate', 1300)
    const { hits } = await close(page, 1400)
    const together = both(hits, ITEM_CHILD, CLONE_CHILD)
    expect(together.length).toBeGreaterThanOrEqual(20)
    for (const hit of together) {
        expect(
            centresNear(hit.rects[CLONE_CHILD]!, hit.rects[ITEM_CHILD]!),
            `at ${hit.t.toFixed(0)}ms: ${JSON.stringify(hit.rects)}`
        ).toBe(true)
    }
})

/** The page's rAF log since `since` (epoch ms), in seconds since then. */
const logSince = (page: Page, since: number) =>
    page.evaluate((since) => {
        const log = (window as unknown as { nestedLog: LogEntry[] }).nestedLog
        return log
            .filter((entry) => entry.t >= since)
            .map((entry) => ({ ...entry, t: (entry.t - since) / 1000 }))
    }, since)

/**
 * Close, then the log from the frame the exit clone first appears (the
 * removal), so a click's own latency doesn't count as exit time.
 */
async function closeAndLog(page: Page, ms: number) {
    const clicked = await page.evaluate(() => performance.timeOrigin + performance.now())
    await page.locator('#close').click()
    await page.waitForTimeout(ms)
    const removedAt = await page.evaluate((clicked) => {
        const log = (window as unknown as { nestedLog: LogEntry[] }).nestedLog
        return log.find((entry) => entry.t >= clicked && entry.cloneConnected)?.t ?? clicked
    }, clicked)
    return logSince(page, removedAt)
}

/** The propagated `#fade` exit runs on its clone copy: opacity 1 − t, scale 1 − t/2. */
function expectFadeExit(log: Awaited<ReturnType<typeof logSince>>) {
    const fading = log.filter((entry) => entry.fadeOpacity !== null && entry.t <= 1.05)
    expect(fading.length).toBeGreaterThan(20)
    for (const entry of fading) {
        const t = Math.min(1, Math.max(0, entry.t))
        expect(entry.fadeOpacity!, `opacity at ${entry.t.toFixed(3)}s`).toBeCloseTo(1 - t, 1)
        expect(Math.abs(entry.fadeOpacity! - (1 - t))).toBeLessThanOrEqual(0.05)
        expect(Math.abs(entry.fadeScale! - (1 - 0.5 * t))).toBeLessThanOrEqual(0.05)
    }
}

/** The clone stays until the 1 s exit ends, then goes within two frames. */
function expectCloneUntilFadeEnds(log: Awaited<ReturnType<typeof logSince>>) {
    const connected = log.filter((entry) => entry.cloneConnected)
    expect(connected.some((entry) => entry.t >= 0.3 && entry.t <= 0.9)).toBe(true)
    for (const entry of log.filter((e) => e.t >= 0.3 && e.t <= 0.9)) {
        expect(entry.cloneConnected, `clone at ${entry.t.toFixed(3)}s`).toBe(true)
    }
    const lastConnected = connected[connected.length - 1].t
    expect(lastConnected).toBeGreaterThanOrEqual(0.95)
    expect(lastConnected).toBeLessThanOrEqual(1 + 2 / 60 + 0.02)
}

test('NC5: a propagating boundary inside a held clone runs its child’s own exit, and the clone waits for it', async ({
    page
}) => {
    await openLightbox(page, '&inner=propagate&innerExit=true&fast=true', 600)
    const log = await closeAndLog(page, 1500)
    expectFadeExit(log)
    expectCloneUntilFadeEnds(log)
})

test('NC6: a propagating boundary inside a non-layout exit runs its child’s exit; onExitComplete fires once after it', async ({
    page
}) => {
    await openLightbox(page, '&outer=plain&inner=propagate&innerExit=true', 600)
    const log = await closeAndLog(page, 1500)
    expectFadeExit(log)
    expectCloneUntilFadeEnds(log)
    for (const entry of log) {
        if (entry.t < 0.95) expect(entry.innerDone, `#inner-done at ${entry.t.toFixed(3)}s`).toBe(0)
        expect(entry.innerDone).toBeLessThanOrEqual(1)
    }
    await expect(page.locator('#inner-done')).toHaveText('1')
})

/**
 * Plan 012 A4: a second open and close on the same page load. The second
 * close must look like the first: the held clone follows `#item-parent` and
 * its nested dot follows `#item-child` on every frame.
 */
test('two cycles: the second close follows the gallery item like the first', async ({ page }) => {
    await openLightbox(page, '', 1300)
    for (const cycle of [1, 2]) {
        if (cycle === 2) {
            await page.locator('#item-parent').click()
            await page.waitForTimeout(1300)
        }
        const { hits } = await close(page, 1400)
        const outer = both(hits, ITEM_PARENT, CLONE)
        const inner = both(hits, ITEM_CHILD, CLONE_CHILD)
        expect(outer.length, `cycle ${cycle}: outer frames`).toBeGreaterThanOrEqual(20)
        expect(inner.length, `cycle ${cycle}: inner frames`).toBeGreaterThanOrEqual(20)
        for (const hit of outer) {
            expect(
                centresNear(hit.rects[CLONE]!, hit.rects[ITEM_PARENT]!),
                `cycle ${cycle} at ${hit.t.toFixed(0)}ms: ${JSON.stringify(hit.rects)}`
            ).toBe(true)
        }
        for (const hit of inner) {
            expect(
                centresNear(hit.rects[CLONE_CHILD]!, hit.rects[ITEM_CHILD]!),
                `cycle ${cycle} at ${hit.t.toFixed(0)}ms: ${JSON.stringify(hit.rects)}`
            ).toBe(true)
        }
        await expect.poll(() => page.locator('[data-clone]').count(), { timeout: 1500 }).toBe(0)
    }
})
