import { expect, test, type Page } from '@playwright/test'

/**
 * #4022: an element looping rotateY on the compositor mustn't be measured
 * for layout with its rotation applied. That box isn't its layout, so it
 * would get a layout animation, with its own infinite transition, that
 * distorts every rotation after.
 *
 * Port of upstream `tests/react/layout-sibling-rotating-3d.spec.ts` @ `v14.7.1`
 * (fix `6c6edff28`, Motion 14.7.1), against
 * `src/routes/tests/independent-transforms/layout-sibling-rotating-3d/+page.svelte`
 * and `src/routes/tests/independent-transforms/layout-ancestor-rotating-3d/+page.svelte`.
 *
 * The pages record every painted frame in-page (`onPaintedFrame`). Each test
 * also annotates which measuring path ran, as evidence only: frames where the
 * pack had no transform animation (`count === 0`, demoted to the main thread
 * by upstream's `willUpdate` path) and the `layoutMeasureStats` delta across
 * the trigger (svelte-motion's speculative reads).
 *
 * Svelte deviation: upstream's "unmounting" case relies on React Strict
 * Mode's remount. Here `window.remount()` re-keys the `layoutId="pack"`
 * element, which goes through svelte-motion's own `layoutId` takeover. A
 * takeover mounts as if `initial={false}` (framer-motion
 * `motion/index.tsx:114-122` @ `v14.7.1`), which blocks a loop declared at
 * mount, so the remounted pack mounts with a static `rotateY: 0` and starts
 * its `[0, 360]` loop one frame later.
 */

type Recorded = { transform: string; count: number }
type Stats = { reads: number; silentReads: number }
type FrameWindow = Window & {
    spin: () => void
    remount: () => void
    rerender: () => void
    recordTransforms: (id: string, ms: number) => Promise<Recorded[]>
    measureStats: () => Stats
    countTransformAnimations: (id: string) => number
}

const recordTransforms = (page: Page, id: string): Promise<Recorded[]> =>
    page.evaluate((id) => (window as unknown as FrameWindow).recordTransforms(id, 1000), id)

const measureStats = (page: Page): Promise<Stats> =>
    page.evaluate(() => (window as unknown as FrameWindow).measureStats())

const countPack = (page: Page): Promise<number> =>
    page.evaluate(() => (window as unknown as FrameWindow).countTransformAnimations('pack'))

/** Attaches the path probes to the test output. Evidence only. */
const annotate = (frames: Recorded[], before: Stats, after: Stats, label = '') => {
    test.info().annotations.push(
        {
            type: `${label}pack count === 0 frames`,
            description: `${frames.filter((frame) => frame.count === 0).length} of ${frames.length}`
        },
        {
            type: `${label}measureStats delta`,
            description: `reads +${after.reads - before.reads}, silentReads +${after.silentReads - before.silentReads}`
        }
    )
}

/**
 * With no layout change, projection adds no scale or x/y translate to the
 * rotating element, which keeps rotating. Annotates the path probes since
 * `before` (taken just ahead of the trigger) before asserting.
 */
async function expectUndistorted(page: Page, before: Stats) {
    const recorded = await recordTransforms(page, 'pack')
    annotate(recorded, before, await measureStats(page))
    const transforms = recorded.map((frame) => frame.transform)

    expect(transforms.length).toBeGreaterThan(10)
    for (const transform of transforms) {
        expect(transform).toContain('rotateY(')
        expect(transform).not.toContain('scale')
        expect(transform).not.toMatch(/translate3d\((?!0px, 0px)/)
    }
    expect(transforms[transforms.length - 1]).not.toBe(transforms[0])
}

/**
 * Start the rotation after mount, and wait until it's part way through a
 * loop on the compositor.
 */
async function spin(page: Page, fixture: string) {
    await page.goto(`/tests/independent-transforms/${fixture}?@isPlaywright=true&later`)
    await page.waitForSelector('#pack')
    await page.waitForTimeout(100)
    await page.evaluate(() => (window as unknown as FrameWindow).spin())
    await page.waitForTimeout(1300)

    expect(await countPack(page)).toBe(1)
}

test.describe('layout measurements of a looping 3D rotation', () => {
    test.use({ viewport: { width: 1000, height: 700 } })

    test("a sibling's layout update doesn't distort it", async ({ page }) => {
        await spin(page, 'layout-sibling-rotating-3d')
        const before = await measureStats(page)
        await page.hover('#button')
        await expectUndistorted(page, before)
    })

    test("remounting doesn't distort it", async ({ page }) => {
        await page.goto(
            '/tests/independent-transforms/layout-sibling-rotating-3d?@isPlaywright=true'
        )
        await page.waitForSelector('#pack')
        await page.waitForTimeout(1300)
        expect(await countPack(page)).toBe(1)

        const old = await page.evaluateHandle(() => document.getElementById('pack'))
        const before = await measureStats(page)
        await page.evaluate(() => (window as unknown as FrameWindow).remount())
        await page.waitForFunction((old) => {
            const pack = document.getElementById('pack')
            return pack !== null && pack !== old
        }, old)
        // The new element mounts at `rotateY: 0` and one frame later its
        // `animate` switches to the `[0, 360]` loop.
        await page.waitForTimeout(1300)
        expect(await countPack(page)).toBe(1)
        await expectUndistorted(page, before)
    })

    test("a child's layout update doesn't distort the child", async ({ page }) => {
        await spin(page, 'layout-ancestor-rotating-3d')
        const before = await measureStats(page)
        await page.evaluate(() => (window as unknown as FrameWindow).rerender())

        const [transforms, pack] = await Promise.all([
            recordTransforms(page, 'child'),
            recordTransforms(page, 'pack')
        ])
        annotate(pack, before, await measureStats(page), 'during child recording: ')
        test.info().annotations.push({
            type: 'child transforms (distinct)',
            description: [...new Set(transforms.map((frame) => frame.transform))]
                .slice(0, 5)
                .join(' | ')
        })
        for (const { transform } of transforms) {
            expect(['', 'none']).toContain(transform)
        }
        await expectUndistorted(page, before)
    })
})
