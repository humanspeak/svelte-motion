import { expect, test } from '@playwright/test'

/**
 * A `layout` element is mounted as soon as it appears, so a layout change
 * while its enter animation is still starting is an update and animates.
 *
 * Upstream mounts `MeasureLayout` with the element; every later commit runs
 * `getSnapshotBeforeUpdate` → `willUpdate()` (framer-motion
 * `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`
 * @ `v14.2.0`, 39-98). Against
 * `src/routes/tests/independent-transforms/layout-mount-ready/+page.svelte`.
 */

type Rect = { t: number; left: number; top: number; width: number }
type MountWindow = {
    mountAndSample: (
        ms: number
    ) => Promise<{ samples: Record<string, Rect[]>; widenedAt: number | null }>
}

const maxStep = (rects: Rect[], key: Exclude<keyof Rect, 't'>) => {
    let max = 0
    for (let i = 1; i < rects.length; i++) {
        max = Math.max(max, Math.abs(rects[i][key] - rects[i - 1][key]))
    }
    return max
}

test.describe('layout changes during the enter frames', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/independent-transforms/layout-mount-ready?@isPlaywright=true')
        await page.locator('#mount').waitFor()
    })

    test('a width change from onAnimationStart animates instead of jumping', async ({ page }) => {
        const { samples } = await page.evaluate(() =>
            (window as unknown as MountWindow).mountAndSample(1800)
        )
        const rects = samples['enter-change']
        const widths = JSON.stringify(rects.map((rect) => Math.round(rect.width)))

        // Painted at 100px first, so the change has somewhere to animate from.
        expect(rects[0].width, `first painted width in ${widths}`).toBeLessThan(110)
        // 200px over 1s linear is ~3.3px per frame; a jump is 200px.
        expect(maxStep(rects, 'width'), `widths ${widths}`).toBeLessThanOrEqual(40)
        expect(Math.abs(rects.at(-1)!.width - 300)).toBeLessThanOrEqual(2)
    })

    test('a later layout animation starts from where the box is drawn', async ({ page }) => {
        const { samples, widenedAt } = await page.evaluate(() =>
            (window as unknown as MountWindow).mountAndSample(1800)
        )
        expect(widenedAt).not.toBeNull()
        const frames = samples['sibling-shift']
        const first = frames.findIndex((rect) => rect.t >= widenedAt!)
        expect(first).toBeGreaterThan(0)
        const widen = frames.slice(first - 1)
        const trace = JSON.stringify(
            widen.map((rect) => [
                Math.round(rect.left),
                Math.round(rect.top),
                Math.round(rect.width)
            ])
        )

        expect(maxStep(widen, 'left'), `left/top/width ${trace}`).toBeLessThanOrEqual(10)
        expect(maxStep(widen, 'top'), `left/top/width ${trace}`).toBeLessThanOrEqual(10)
        expect(maxStep(widen, 'width'), `left/top/width ${trace}`).toBeLessThanOrEqual(40)
    })
})

/**
 * A Svelte-owned layout commit that lands after this frame's frameloop is
 * still projected before that frame is painted.
 *
 * Upstream `didUpdate()` → `microtask.read(scheduleUpdate)` → `update()`,
 * which runs `frameSteps.update/preRender/render.process(frameData)`
 * synchronously (motion-dom `packages/motion-dom/src/projection/node/create-projection-node.ts`
 * @ `v14.2.0`, 836-847): the projection transform is written in the same task
 * as the commit, whatever frame phase it lands in.
 */
test.describe('layout commits that land after the frameloop', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    const expectAnimatedFrom100 = (widths: number[], label: string) => {
        const trace = `${label} painted widths ${JSON.stringify(widths.map(Math.round))}`
        expect(widths[0], trace).toBeLessThan(110)
        let step = 0
        for (let i = 1; i < widths.length; i++) {
            step = Math.max(step, Math.abs(widths[i] - widths[i - 1]))
        }
        expect(step, trace).toBeLessThanOrEqual(40)
        expect(Math.abs(widths.at(-1)! - 300), trace).toBeLessThanOrEqual(2)
    }

    test('tester mode (panel shown): the onAnimationStart width change animates', async ({
        page
    }) => {
        // No `@isPlaywright=true`: the TesterPanel renders, which moves the
        // enter flush after the frameloop (the maintainer-reported timing).
        await page.goto('/tests/independent-transforms/layout-mount-ready')
        await page.locator('#mount').waitFor()
        const { samples } = await page.evaluate(() =>
            (window as unknown as MountWindow).mountAndSample(1800)
        )
        expectAnimatedFrom100(
            samples['enter-change'].map((rect) => rect.width),
            'tester mode #enter-change'
        )
    })
})
