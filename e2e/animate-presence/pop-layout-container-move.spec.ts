import { expect, test, type Page } from '@playwright/test'

/**
 * Issue #2348: `popLayout` position incorrectly calculated. Port of upstream
 * `tests/react/issue-2348.spec.ts` @ v14.7.1, run for both exit paths: `clone`
 * (keyed children of one `AnimatePresence`) and `owned` (each item its own
 * `<AnimatePresence present>` holding the real node).
 *
 * Reporter's repro: AnimatePresence `mode="popLayout"` with `layout` items
 * exiting via `scale: 0.8, opacity: 0`, inside a `ul` with `position: fixed`.
 * In a fixed bottom-right container (a toast list), exiting items drop
 * downwards instead of shrinking towards their own centre.
 *
 * The pop pins the item to its offsetParent's edges, but popping it out of
 * the flow shrinks the `ul`. A bottom-anchored (or centred) `ul` then moves,
 * carrying the popped item with it.
 *
 * A scale exit keeps the box centre fixed, so an exiting item's centre must
 * not move. The clock is mocked so the mid-exit read is deterministic.
 */
type Path = 'clone' | 'owned'

interface Centre {
    x: number
    y: number
}

const PATHS: Path[] = ['clone', 'owned']

const item = (id: number) => `[data-testid="item-${id}"]`

/** The item, once popped: the owned node gets a pop id, the clone path a clone. */
const popped = (path: Path, id: number) =>
    path === 'owned' ? `${item(id)}[data-motion-pop-id]` : `${item(id)}[data-clone="true"]`

function readCentre(page: Page, id: number): Promise<Centre> {
    return page.evaluate((selector) => {
        const box = document.querySelector(selector)!.getBoundingClientRect()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }, item(id))
}

const click = (page: Page, selector: string) =>
    page.evaluate((selector) => document.querySelector<HTMLElement>(selector)!.click(), selector)

async function setup(page: Page, path: Path, query: string) {
    await page.clock.install({ time: 0 })
    await page.clock.pauseAt(1000)

    await page.goto(
        `/tests/animate-presence/pop-layout-container-move?@isPlaywright=true&popLayout&path=${path}${query}`
    )
    await page.waitForFunction(() => window.MotionIsMounted === true)
    await expect(page.locator(item(0))).toBeVisible()

    for (let i = 1; i <= 3; i++) {
        await click(page, '[data-testid="add"]')
        await expect(page.locator(item(i))).toBeVisible()
    }

    /**
     * Let the spring layout animations from adding items settle.
     */
    await page.clock.runFor(3000)
}

async function exitItem(page: Page, path: Path, query: string) {
    await setup(page, path, query)

    const before = await readCentre(page, 1)

    await click(page, item(1))
    await expect(page.locator(popped(path, 1))).toHaveCount(1)

    /**
     * Early in the spring exit, while the item is still popped out and
     * mid-scale.
     */
    await page.clock.runFor(100)
    const after = await readCentre(page, 1)

    return { before, after }
}

for (const path of PATHS) {
    test.describe(`AnimatePresence popLayout when popping moves the container (${path})`, () => {
        for (const [name, query] of [
            ['static container', ''],
            ['fixed, top-anchored container', '&fixed&anchor=top'],
            ['fixed, bottom-anchored container', '&fixed&anchor=bottom'],
            [
                'fixed, bottom-anchored container, anchorY: bottom',
                '&fixed&anchor=bottom&anchorY=bottom'
            ],
            ['fixed, transform-centred container', '&fixed&anchor=center'],
            ['static container, anchorY: bottom', '&anchorY=bottom'],
            /**
             * The list's offsets are in its local, scaled, coordinate space,
             * so a move measured on screen must be scaled into it.
             */
            ['bottom-anchored container in a scale(0.5) ancestor', '&fixed&anchor=bottom&scale']
        ]) {
            test(`popLayout exiting item shrinks towards its centre (${name})`, async ({
                page
            }) => {
                const { before, after } = await exitItem(page, path, query)

                expect(Math.abs(after.x - before.x)).toBeLessThan(1)
                expect(Math.abs(after.y - before.y)).toBeLessThan(1)
            })
        }

        /**
         * Toast list: the oldest item exits as a new one arrives, in the same
         * update. The container's size, and so its position, ends up
         * unchanged, so the exiting item mustn't be offset for the container's
         * state part-way through the update.
         */
        test('popLayout exiting item stays put when an item is added in the same render', async ({
            page
        }) => {
            await setup(page, path, '&fixed&anchor=bottom')

            const before = await readCentre(page, 0)

            await click(page, '[data-testid="cycle"]')
            await expect(page.locator(popped(path, 0))).toHaveCount(1)
            await page.clock.runFor(100)
            const after = await readCentre(page, 0)

            expect(Math.abs(after.x - before.x)).toBeLessThan(1)
            expect(Math.abs(after.y - before.y)).toBeLessThan(1)
        })

        /**
         * Removing an item at the bottom of a scrolled page, or scrollable
         * element, shrinks its content, which clamps the scroll position and
         * moves everything in it. The exiting item should move with the
         * content rather than stay put on screen, where the items above it
         * now are.
         */
        for (const [name, query] of [
            ['page', '&scroll'],
            ['scrollable element', '&scroller'],
            /**
             * The scroll offset is in the scrollable element's own, here
             * scaled, coordinate space, so must be scaled onto the screen.
             */
            ['positioned scrollable element in a scale(0.5) ancestor', '&scroller&positioned&scale']
        ]) {
            test(`popLayout exiting item moves with the content when the ${name}'s scroll position is clamped`, async ({
                page
            }) => {
                await setup(page, path, query)

                const readScroll = () =>
                    page.evaluate(
                        (isElement) =>
                            isElement
                                ? document.querySelector('[data-testid="scroller"]')!.scrollTop
                                : window.scrollY,
                        query.includes('scroller')
                    )

                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight)
                    const scroller = document.querySelector('[data-testid="scroller"]')!
                    scroller.scrollTop = scroller.scrollHeight
                })

                const readOffset = async () =>
                    (await readCentre(page, 1)).y - (await readCentre(page, 0)).y

                const scrollBefore = await readScroll()
                const before = await readOffset()

                await click(page, item(1))
                await expect(page.locator(popped(path, 1))).toHaveCount(1)
                await page.clock.runFor(100)

                // The scroll position was clamped...
                expect(await readScroll()).toBeLessThan(scrollBefore - 50)
                // ...and the exiting item kept its place relative to the item above it.
                expect(Math.abs((await readOffset()) - before)).toBeLessThan(1)
            })
        }

        /**
         * A fixed container doesn't scroll with the page, so the page's scroll
         * position being clamped, here because removing the item also shrinks
         * the page, mustn't be mistaken for the container moving. (The list
         * has `layoutScroll`, so the items' layout animations account for
         * that too.)
         */
        test("popLayout exiting item in a fixed container stays put when the page's scroll position is clamped", async ({
            page
        }) => {
            await setup(page, path, '&fixed&anchor=bottom&scroll&mirror&layoutScroll')

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            const scrollBefore = await page.evaluate(() => window.scrollY)
            const before = await readCentre(page, 1)

            await click(page, item(1))
            await expect(page.locator(popped(path, 1))).toHaveCount(1)
            await page.clock.runFor(100)

            expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrollBefore - 50)
            const after = await readCentre(page, 1)
            expect(Math.abs(after.x - before.x)).toBeLessThan(1)
            expect(Math.abs(after.y - before.y)).toBeLessThan(1)
        })
    })
}

/**
 * Real time, at human speed: items are added a couple of seconds apart, so
 * each add's layout animation settles while the list rests, then one is
 * removed. The mocked-clock cases above add every item before anything
 * settles, so they never see a "before" point measured while the items
 * moved and then left to go stale. Samples the exiting item's centre every
 * frame for 300 ms, starting on the click itself.
 */
async function realTimeDrift(
    page: Page,
    url: string,
    id: number,
    adds: number,
    add: string,
    scroll = false
) {
    await page.goto(url)
    await page.waitForFunction(() => window.MotionIsMounted === true)
    for (let i = 0; i < adds; i++) {
        await page.waitForTimeout(2000)
        await click(page, add)
    }
    await page.waitForTimeout(2000)
    if (scroll) {
        // Scroll the page while the list rests, then remove.
        const scrolled = await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight)
            return window.scrollY
        })
        expect(scrolled).toBeGreaterThan(50)
        await page.waitForTimeout(300)
    }

    return page.evaluate(
        ({ selector }) =>
            new Promise<number>((resolve) => {
                const centre = () => {
                    const box = document.querySelector(selector)?.getBoundingClientRect()
                    return box && { x: box.x + box.width / 2, y: box.y + box.height / 2 }
                }
                const before = centre()!
                let drift = 0
                const start = performance.now()
                const sample = () => {
                    const now = centre()
                    if (now) drift = Math.max(drift, Math.hypot(now.x - before.x, now.y - before.y))
                    if (performance.now() - start < 300) requestAnimationFrame(sample)
                    else resolve(drift)
                }
                document.querySelector<HTMLElement>(selector)!.click()
                requestAnimationFrame(sample)
            }),
        { selector: `[data-testid$="item-${id}"]` }
    )
}

for (const path of PATHS) {
    test.describe(`popLayout at human speed: items added while the list rests (${path})`, () => {
        for (const [name, query] of [
            ['fixed, bottom-anchored container', '&fixed&anchor=bottom'],
            [
                'fixed, bottom-anchored container, anchorY: bottom',
                '&fixed&anchor=bottom&anchorY=bottom'
            ],
            ['fixed, transform-centred container', '&fixed&anchor=center']
        ]) {
            test(`exiting item holds after two adds (${name})`, async ({ page }) => {
                const drift = await realTimeDrift(
                    page,
                    `/tests/animate-presence/pop-layout-container-move?@isPlaywright=true&popLayout&path=${path}${query}`,
                    1,
                    2,
                    '[data-testid="add"]'
                )
                expect(drift).toBeLessThan(1)
            })
        }

        /**
         * A "fixed" list inside a transformed ancestor scrolls with the page,
         * but the point's scroll walk stops at it (it is `position: fixed`),
         * so a point recorded before the page scrolled is stale after.
         */
        test('exiting item holds after the page scrolls while it rests (scale(0.5) ancestor)', async ({
            page
        }) => {
            const drift = await realTimeDrift(
                page,
                `/tests/animate-presence/pop-layout-container-move?@isPlaywright=true&popLayout&path=${path}&fixed&anchor=bottom&scale`,
                1,
                2,
                '[data-testid="add"]',
                true
            )
            expect(drift).toBeLessThan(1)
        })
    })
}

test.describe('popLayout playground (#2348)', () => {
    /** The largest centre drift a `drift-<id>` readout reports, in px. */
    const readDrift = async (page: Page, id: number) => {
        const readout = page.locator(`[data-testid="drift-${id}"]`)
        await expect(readout).toBeVisible()
        return Number(/max centre drift ([\d.]+)px/.exec((await readout.textContent()) ?? '')?.[1])
    }

    test('loads, renders the default preset and reads a held removal', async ({ page }) => {
        await page.goto('/tests/animate-presence/pop-layout-playground?@isPlaywright=true')
        await page.waitForFunction(() => window.MotionIsMounted === true)
        for (let id = 0; id <= 3; id++) {
            await expect(page.locator(`[data-testid="pg-item-${id}"]`)).toBeVisible()
        }

        await click(page, '[data-testid="pg-item-1"]')

        const readout = page.locator('[data-testid="drift-1"]')
        await expect(readout).toBeVisible()
        expect(
            Number(/max centre drift ([\d.]+)px/.exec((await readout.textContent()) ?? '')?.[1])
        ).toBeLessThanOrEqual(1)

        // At human speed: add an item, let the list rest, then remove another.
        await click(page, '[data-testid="pg-add"]')
        await page.waitForTimeout(2000)
        await click(page, '[data-testid="pg-item-2"]')
        const later = page.locator('[data-testid="drift-2"]')
        await expect(later).toBeVisible()
        expect(
            Number(/max centre drift ([\d.]+)px/.exec((await later.textContent()) ?? '')?.[1])
        ).toBeLessThanOrEqual(1)
    })

    /**
     * Toast queue on the owned path: the oldest item exits while `{#each}`
     * inserts a new one in the same update. The exiting item's own layout
     * snapshot must be its box from before the insert (upstream snapshots
     * in `getSnapshotBeforeUpdate`, `MeasureLayout.tsx:149-204` @ v14.7.1).
     */
    test('toast queue, owned path: the oldest item holds when one is added in the same update', async ({
        page
    }) => {
        await page.goto(
            '/tests/animate-presence/pop-layout-playground?@isPlaywright=true&preset=toast&path=owned'
        )
        await page.waitForFunction(() => window.MotionIsMounted === true)
        await expect(page.locator('[data-testid="pg-item-0"]')).toBeVisible()

        await click(page, '[data-testid="pg-cycle"]')

        expect(await readDrift(page, 0)).toBeLessThanOrEqual(1)
    })

    /**
     * Scrolled page that shrinks, owned path, left unscrolled: removing an
     * item also removes a mirror row, a sibling of the list, in the same
     * update. The exiting item's own layout snapshot must not see it.
     */
    test('scroll-mirror, owned path, unscrolled: the removed item holds', async ({ page }) => {
        await page.goto(
            '/tests/animate-presence/pop-layout-playground?@isPlaywright=true&preset=scroll-mirror&path=owned'
        )
        await page.waitForFunction(() => window.MotionIsMounted === true)
        await expect(page.locator('[data-testid="pg-item-1"]')).toBeAttached()

        await click(page, '[data-testid="pg-item-1"]')

        expect(await readDrift(page, 1)).toBeLessThanOrEqual(1)
    })
})
