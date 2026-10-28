/**
 * Port of upstream motion `tests/react/issue-1935.spec.ts` @ v14.7.1
 * (https://github.com/motiondivision/motion/issues/1935, motion-dom commits
 * 012185841, 79a4865e7, 64c6818bb and 95c017019). Fixture:
 * src/routes/tests/layout-root/+page.svelte, a port of
 * `dev/react/src/tests/issue-1935.tsx`.
 *
 * #1935: a shared layoutId animation inside a layoutRoot should animate
 * relative to the layoutRoot, like a plain layout animation does. Here the
 * tab list shifts 150px left in the same render as the underline moves from
 * Tomato to Lettuce, so the underline should slide one tab (0px to 100px)
 * across the list, not fly in from where Tomato was on the page.
 */
import { expect, Page, test } from '@playwright/test'

declare global {
    interface Window {
        records: {
            underlines: number[]
            underlineTops: number[]
            underlineWidths: number[]
            list: number
            listTop: number
            rendered: boolean
        }[]
        recording: boolean
    }
}

async function selectLettuce(page: Page, query: string, before = { underline: 350, list: 350 }) {
    await page.setViewportSize({ width: 1000, height: 660 })
    await page.goto(`/tests/layout-root?@isPlaywright=true&${query}`)
    // Not in upstream: wait for hydration, so the click isn't lost
    await expect(page.locator('.fixture-1935[data-hydrated]')).toBeAttached()
    await expect(page.locator('.underline')).toBeVisible()

    // Wait for anything that animates on mount to settle
    await expect
        .poll(() =>
            page.evaluate(() => ({
                underline: document.querySelector('.underline')!.getBoundingClientRect().left,
                list: document.querySelector('ul')!.getBoundingClientRect().left
            }))
        )
        .toEqual(before)

    await page.click('#lettuce')
    // The underline transition is 1s
    await page.waitForTimeout(1300)

    return page.evaluate(() => {
        window.recording = false
        // Drop frames recorded before React rendered the click
        const first = window.records.findIndex(({ rendered }) => rendered)
        return window.records.slice(first)
    })
}

function expectSlideAcrossList(offsets: number[], from = 0, to = 100) {
    // From Tomato (0px) to Lettuce (100px) within the list, by default
    expect(Math.abs(offsets[0] - from)).toBeLessThan(5)
    for (const offset of offsets) {
        expect(offset).toBeGreaterThanOrEqual(from - 0.5)
        expect(offset).toBeLessThanOrEqual(to + 0.5)
    }
    for (let i = 1; i < offsets.length; i++) {
        expect(offsets[i]).toBeGreaterThanOrEqual(offsets[i - 1] - 0.5)
    }
    // Mid-animation it's partway, not already at the end
    const range = to - from
    expect(offsets.some((o) => o > from + range * 0.3 && o < to - range * 0.3)).toBe(true)
    expect(offsets[offsets.length - 1]).toBeCloseTo(to, 0)
}

/**
 * Crossfading underlines are both mounted and in the same place
 */
function expectCrossfade(records: { underlines: number[] }[]) {
    const crossfading = records.filter(({ underlines }) => underlines.length === 2)
    expect(crossfading.length).toBeGreaterThan(20)
    for (const { underlines } of crossfading) {
        expect(underlines[0]).toBeCloseTo(underlines[1], 0)
    }
}

/**
 * The left edge of the new underline relative to the list, per frame
 */
const leadOffsets = (records: { underlines: number[]; list: number }[]) =>
    records.map(({ underlines, list }) => underlines[underlines.length - 1] - list)

test('Shared layout animation inside a layoutRoot animates relative to it', async ({ page }) => {
    const records = await selectLettuce(page, '')
    expect(records.length).toBeGreaterThan(20)

    // The list jumps to its new position and the underline only travels
    // one tab within it
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)
    expectSlideAcrossList(records.map(({ underlines, list }) => underlines[0] - list))
})

// Plan 012: no relegate on the exit clone.
// svelte-motion's `AnimatePresence` exits a direct child as a detached clone
// with no projection node, and nothing relegates the exiting lead, so it can't
// follow the new lead in a crossfade. Un-fixme when shared-layout crossfades
// with exiting elements are ported (plan 012 in .agents/.plans/motion-14-7-1).
test.fixme('Crossfading shared layout animation inside a layoutRoot animates relative to it', async ({
    page
}) => {
    const records = await selectLettuce(page, 'exit=true')
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)

    // Both underlines are mounted while the old one fades out
    const crossfading = records.filter(({ underlines }) => underlines.length === 2)
    expect(crossfading.length).toBeGreaterThan(20)

    // The new underline slides across the list, and the old one follows it
    expectSlideAcrossList(
        records.map(({ underlines, list }) => underlines[underlines.length - 1] - list)
    )
    for (const { underlines } of crossfading) {
        expect(underlines[0]).toBeCloseTo(underlines[1], 0)
    }
})

test('Shared layout animation inside a translated layoutRoot animates relative to it', async ({
    page
}) => {
    const records = await selectLettuce(page, 'offset=true', {
        underline: 400,
        list: 400
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list, listTop } of records) {
        expect(list).toBeCloseTo(250, 0)
        expect(listTop).toBeCloseTo(100, 0)
    }

    // The ancestor's translate isn't applied to the underline twice
    expectSlideAcrossList(records.map(({ underlines, list }) => underlines[0] - list))
    for (const { underlineTops, listTop } of records) {
        expect(underlineTops[0] - listTop).toBeCloseTo(38, 0)
    }
})

test('Shared layout="position" animation inside a layoutRoot only animates position', async ({
    page
}) => {
    // The list is 360px wide, so it starts at 320px and moves to 170px
    const records = await selectLettuce(page, 'layout=position', {
        underline: 320,
        list: 320
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(170, 0)

    expectSlideAcrossList(
        records.map(({ underlines, list }) => underlines[underlines.length - 1] - list)
    )
    // The underline is Lettuce's width throughout
    for (const { underlineWidths } of records) {
        expect(underlineWidths[underlineWidths.length - 1]).toBeCloseTo(160, 0)
    }
})

test('Shared layout="size" animation inside a layoutRoot only animates size', async ({ page }) => {
    const records = await selectLettuce(page, 'layout=size', {
        underline: 320,
        list: 320
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(170, 0)

    // The underline is under Lettuce throughout and grows to its width
    const widths = records.map(({ underlineWidths }) => underlineWidths[underlineWidths.length - 1])
    for (const { underlines, list } of records) {
        expect(underlines[underlines.length - 1] - list).toBeCloseTo(100, 0)
    }
    expect(widths[0]).toBeLessThan(105)
    expect(widths.some((w) => w > 120 && w < 140)).toBe(true)
    expect(widths[widths.length - 1]).toBeCloseTo(160, 0)
})

test('Shared layout animation without a layoutRoot animates in page space', async ({ page }) => {
    const records = await selectLettuce(page, 'layoutRoot=false')
    expect(records.length).toBeGreaterThan(20)

    // Starts where Tomato's underline was on the page (350px) and ends under
    // Lettuce's new position (300px)
    const lefts = records.map(({ underlines }) => underlines[0])
    expect(lefts[0]).toBeGreaterThan(340)
    for (const left of lefts) {
        expect(left).toBeGreaterThanOrEqual(299.5)
        expect(left).toBeLessThanOrEqual(350.5)
    }
    expect(lefts[lefts.length - 1]).toBeCloseTo(300, 0)
})

test('Shared layout animation from outside a layoutRoot starts from its page position', async ({
    page
}) => {
    // The underline starts in a box left of the list, at 300px
    const records = await selectLettuce(page, 'outside=true', {
        underline: 300,
        list: 400
    })
    expect(records.length).toBeGreaterThan(20)

    // The sidebar moves the list to 250px and Lettuce's underline to 350px.
    // The animation starts where the underline was on the page, not 100px
    // left of the list (150px), where it was relative to the list.
    const lefts = records.map(({ underlines }) => underlines[0])
    expect(lefts[0]).toBeGreaterThan(295)
    for (const left of lefts) {
        expect(left).toBeGreaterThanOrEqual(299.5)
        expect(left).toBeLessThanOrEqual(350.5)
    }
    expect(lefts[lefts.length - 1]).toBeCloseTo(350, 0)
})

// Plan 012: no relegate on the exit clone.
// svelte-motion's `AnimatePresence` exits a direct child as a detached clone
// with no projection node, and nothing relegates the exiting lead, so it can't
// follow the new lead in a crossfade. Un-fixme when shared-layout crossfades
// with exiting elements are ported (plan 012 in .agents/.plans/motion-14-7-1).
test.fixme('Crossfading from a translated box outside a layoutRoot keeps the old underline on the new one', async ({
    page
}) => {
    // The box outside the list is translated 80px, so the old underline
    // starts at 380px and stays mounted while it fades out
    const records = await selectLettuce(page, 'outside=true&exit=true&outsideX=80', {
        underline: 380,
        list: 400
    })
    expect(records.length).toBeGreaterThan(20)

    const crossfading = records.filter(({ underlines }) => underlines.length === 2)
    expect(crossfading.length).toBeGreaterThan(20)

    // The new underline animates in page space, from 380px to 350px, and
    // the old one follows it: its translated ancestor isn't ignored
    const lefts = records.map(({ underlines }) => underlines[underlines.length - 1])
    expect(lefts[0]).toBeGreaterThan(375)
    expect(lefts[lefts.length - 1]).toBeCloseTo(350, 0)
    for (const { underlines } of crossfading) {
        expect(underlines[0]).toBeCloseTo(underlines[1], 0)
    }
})

/**
 * Tomato's underline is wrapped in a box inside its tab that's translated
 * 80px, so it starts visually 80px into the list (430px on the page). The
 * new underline should start there, relative to the list, and slide to
 * Lettuce (100px into the list).
 */
test('Shared layout animation from a translated box inside a layoutRoot starts from its visual position', async ({
    page
}) => {
    const records = await selectLettuce(page, 'innerX=80', {
        underline: 430,
        list: 350
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)

    expectSlideAcrossList(leadOffsets(records), 80)
})

// Plan 012: no relegate on the exit clone.
// svelte-motion's `AnimatePresence` exits a direct child as a detached clone
// with no projection node, and nothing relegates the exiting lead, so it can't
// follow the new lead in a crossfade. Un-fixme when shared-layout crossfades
// with exiting elements are ported (plan 012 in .agents/.plans/motion-14-7-1).
test.fixme('Crossfading from a translated box inside a layoutRoot keeps the old underline on the new one', async ({
    page
}) => {
    const records = await selectLettuce(page, 'innerX=80&exit=true', {
        underline: 430,
        list: 350
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)

    // The new underline slides from the old one's visual position (checked
    // first, so plan 012 sees the slide before the crossfade)
    expectSlideAcrossList(leadOffsets(records), 80)
    // The old underline's translated box isn't ignored
    expectCrossfade(records)
})

/**
 * Not in upstream's spec (plan 007 amendment A1): the slide half of the case
 * above, which runs while the crossfade half waits for plan 012. The new
 * underline starts from the exiting one's visual position, 80px into the
 * list, and slides to Lettuce.
 */
test('Crossfading from a translated box inside a layoutRoot: the new underline slides from its visual position', async ({
    page
}) => {
    const records = await selectLettuce(page, 'innerX=80&exit=true', {
        underline: 430,
        list: 350
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)

    expectSlideAcrossList(leadOffsets(records), 80)
})

// Plan 012: no relegate on the exit clone.
// svelte-motion's `AnimatePresence` exits a direct child as a detached clone
// with no projection node, and nothing relegates the exiting lead, so it can't
// follow the new lead in a crossfade. Un-fixme when shared-layout crossfades
// with exiting elements are ported (plan 012 in .agents/.plans/motion-14-7-1).
test.fixme('Crossfading inside a scrolled layoutScroll box in a layoutRoot animates relative to it', async ({
    page
}) => {
    // The tabs are in a box in the list that's scrolled 50px, so Tomato's
    // underline starts at 300px, 50px left of the list
    const records = await selectLettuce(page, 'scroll=50&exit=true', {
        underline: 300,
        list: 350
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)

    // From -50px to 50px within the list: the scroll applies to both
    expectSlideAcrossList(leadOffsets(records), -50, 50)
    expectCrossfade(records)
})

// Plan 012: no relegate on the exit clone.
// svelte-motion's `AnimatePresence` exits a direct child as a detached clone
// with no projection node, and nothing relegates the exiting lead, so it can't
// follow the new lead in a crossfade. Un-fixme when shared-layout crossfades
// with exiting elements are ported (plan 012 in .agents/.plans/motion-14-7-1).
test.fixme('Crossfading translated underlines inside a layoutRoot keeps their translate', async ({
    page
}) => {
    // Both underlines are translated 10px
    const records = await selectLettuce(page, 'underlineX=10&exit=true', {
        underline: 360,
        list: 350
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)

    expectSlideAcrossList(leadOffsets(records), 10, 110)
    expectCrossfade(records)
})

// Plan 012: no relegate on the exit clone.
// svelte-motion's `AnimatePresence` exits a direct child as a detached clone
// with no projection node, and nothing relegates the exiting lead, so it can't
// follow the new lead in a crossfade. Un-fixme when shared-layout crossfades
// with exiting elements are ported (plan 012 in .agents/.plans/motion-14-7-1).
test.fixme('Crossfading inside a scaled ancestor of a layoutRoot animates relative to it', async ({
    page
}) => {
    // The ancestor's 0.8 scale makes the tabs 80px wide, and the list starts
    // at 430px
    const records = await selectLettuce(page, 'offset=true&offsetScale=0.8&exit=true', {
        underline: 430,
        list: 430
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(310, 0)

    expectSlideAcrossList(leadOffsets(records), 0, 80)
    expectCrossfade(records)
    for (const { underlineTops, listTop } of records) {
        for (const top of underlineTops) {
            expect(top - listTop).toBeCloseTo(30.4, 0)
        }
    }
})

/**
 * Not in upstream's spec (plan 007 amendment A1): the same `layout` types in
 * page space, without a layoutRoot. The list is 360px wide and jumps from
 * 320px to 170px, so Tomato's underline was at 320px and Lettuce's is at
 * 270px, 160px wide. Upstream resizes the shared snapshot to the new layout
 * before animating (`resizeSnapshot` in `notifyLayoutUpdate`).
 */
test('Shared layout="position" animation without a layoutRoot animates position in page space', async ({
    page
}) => {
    const records = await selectLettuce(page, 'layoutRoot=false&layout=position', {
        underline: 320,
        list: 320
    })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(170, 0)

    // From Tomato's old page position to Lettuce's, at Lettuce's width
    const lefts = records.map(({ underlines }) => underlines[underlines.length - 1])
    expect(lefts[0]).toBeGreaterThan(315)
    for (let i = 1; i < lefts.length; i++) expect(lefts[i]).toBeLessThanOrEqual(lefts[i - 1] + 0.5)
    expect(lefts.some((left) => left > 285 && left < 305)).toBe(true)
    expect(lefts[lefts.length - 1]).toBeCloseTo(270, 0)
    for (const { underlineWidths } of records) {
        expect(underlineWidths[underlineWidths.length - 1]).toBeCloseTo(160, 0)
    }
})

test('Shared layout="size" animation without a layoutRoot only animates size', async ({ page }) => {
    const records = await selectLettuce(page, 'layoutRoot=false&layout=size', {
        underline: 320,
        list: 320
    })
    expect(records.length).toBeGreaterThan(20)

    // Under Lettuce throughout, growing to its width
    for (const { underlines } of records) {
        expect(underlines[underlines.length - 1]).toBeCloseTo(270, 0)
    }
    const widths = records.map(({ underlineWidths }) => underlineWidths[underlineWidths.length - 1])
    expect(widths[0]).toBeLessThan(105)
    expect(widths.some((w) => w > 120 && w < 140)).toBe(true)
    expect(widths[widths.length - 1]).toBeCloseTo(160, 0)
})

/**
 * Not in upstream's spec (plan 007 amendment A1): a second handoff. After
 * Tomato → Lettuce → Tomato, the underline that departs was itself measured
 * in a shared-layout update pass, with its ancestors' transforms reset.
 * Its snapshot must still describe where it was drawn, so the next
 * Tomato → Lettuce slides the same way as the first.
 */
async function selectLettuceAgain(
    page: Page,
    query: string,
    before: { underline: number; list: number }
) {
    await selectLettuce(page, query, before)
    await page.click('#tomato')
    await page.waitForTimeout(1300)
    await expect
        .poll(() =>
            page.evaluate(() => ({
                underline: document.querySelector('.underline')!.getBoundingClientRect().left,
                list: document.querySelector('ul')!.getBoundingClientRect().left
            }))
        )
        .toEqual(before)
    await page.click('#lettuce')
    await page.waitForTimeout(1300)
    return page.evaluate(() => {
        window.recording = false
        const first = window.records.findIndex(({ rendered }) => rendered)
        return window.records.slice(first)
    })
}

test('A second handoff inside a translated layoutRoot still animates relative to it', async ({
    page
}) => {
    const records = await selectLettuceAgain(page, 'offset=true', { underline: 400, list: 400 })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(250, 0)
    expectSlideAcrossList(leadOffsets(records))
})

test('A second handoff from a translated box inside a layoutRoot starts from its visual position', async ({
    page
}) => {
    const records = await selectLettuceAgain(page, 'innerX=80', { underline: 430, list: 350 })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(200, 0)
    expectSlideAcrossList(leadOffsets(records), 80)
})

/**
 * Not in upstream's spec (plan 007 amendment A1): the reverse handoff,
 * Lettuce → Tomato, after the first click. The sidebar goes and the list
 * jumps back right in the same render. Upstream's #1935 handling has no
 * direction (`notifyLayoutUpdate` 2302-2350, `resolveTargetDelta` 1403-1412
 * @ v14.7.1), so it mirrors the forward slide.
 */
async function selectTomatoBack(
    page: Page,
    query: string,
    before: { underline: number; list: number }
) {
    await selectLettuce(page, query, before)
    await page.click('#tomato')
    await page.waitForTimeout(1300)
    return page.evaluate(() => {
        window.recording = false
        // Drop frames recorded before the sidebar went
        const first = window.records.findIndex(({ rendered }) => !rendered)
        return window.records.slice(first)
    })
}

/** A slide from `from` down to `to`: the forward check, mirrored. */
const expectSlideBack = (offsets: number[], from: number, to: number) =>
    expectSlideAcrossList(
        offsets.map((offset) => -offset),
        -from,
        -to
    )

test('A reverse handoff inside a layoutRoot slides back one tab', async ({ page }) => {
    const records = await selectTomatoBack(page, '', { underline: 350, list: 350 })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(350, 0)
    expectSlideBack(leadOffsets(records), 100, 0)
})

test('A reverse handoff inside a translated layoutRoot slides back relative to it', async ({
    page
}) => {
    const records = await selectTomatoBack(page, 'offset=true', { underline: 400, list: 400 })
    expect(records.length).toBeGreaterThan(20)
    for (const { list, listTop } of records) {
        expect(list).toBeCloseTo(400, 0)
        expect(listTop).toBeCloseTo(100, 0)
    }
    expectSlideBack(leadOffsets(records), 100, 0)
    for (const { underlineTops, listTop } of records) {
        expect(underlineTops[0] - listTop).toBeCloseTo(38, 0)
    }
})

/**
 * Back into Tomato's translated box the underline animates in page space:
 * motion-dom's `getClosestProjectingParent` (create-projection-node.ts
 * 1435-1442 @ v14.7.1) gives no relative parent when the parent has a scale
 * or 2D translate. So it starts where Lettuce's underline was on the page
 * (300px) and ends in the box, 80px into the list (430px).
 */
test('A reverse handoff into a translated box inside a layoutRoot animates in page space', async ({
    page
}) => {
    const records = await selectTomatoBack(page, 'innerX=80', { underline: 430, list: 350 })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(350, 0)
    const lefts = records.map(({ underlines }) => underlines[underlines.length - 1])
    expectSlideAcrossList(lefts, 300, 430)
})

test('A reverse layout="size" handoff inside a layoutRoot only animates size', async ({ page }) => {
    const records = await selectTomatoBack(page, 'layout=size', { underline: 320, list: 320 })
    expect(records.length).toBeGreaterThan(20)
    for (const { list } of records) expect(list).toBeCloseTo(320, 0)
    // Under Tomato throughout, shrinking from Lettuce's width to its own
    for (const offset of leadOffsets(records)) expect(offset).toBeCloseTo(0, 0)
    const widths = records.map(({ underlineWidths }) => underlineWidths[underlineWidths.length - 1])
    expect(widths[0]).toBeGreaterThan(155)
    expect(widths.some((w) => w > 120 && w < 140)).toBe(true)
    expect(widths[widths.length - 1]).toBeCloseTo(100, 0)
})
