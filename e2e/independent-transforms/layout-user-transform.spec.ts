import { expect, test } from '@playwright/test'

/**
 * Layout measurements keep transform animations that aren't Motion's own.
 *
 * Upstream demotes only Motion's transform group before measuring
 * (`demoteTransforms` → `transformGroups.get(instance)?.demote()`, motion-dom
 * `packages/motion-dom/src/projection/node/create-projection-node.ts`
 * @ `v14.2.0`, 123-124, used at 707/713/1007). A page's own WAAPI animation
 * or `animate(element, { transform })` stays applied to both the "before" and
 * "after" measurements, so a width change adds no vertical layout delta.
 * Against `src/routes/tests/independent-transforms/layout-user-transform/+page.svelte`.
 */

type PaintedTop = { top: number; y: number; transform: string }
/** `widenAndSampleTops` frames also carry the painted width. */
type DeclarativeFrame = PaintedTop & { width: number }
type UserTransformWindow = {
    widenAndSample: (frames: number) => Promise<Record<string, number[]>>
    widenAndSampleTops: (
        ms: number
    ) => Promise<Record<string, { before: PaintedTop; after: PaintedTop[] }>>
}

test.describe('layout keeps user transform animations', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    for (const id of ['user-waapi', 'user-motion']) {
        test(`widening #${id} adds no vertical layout translate`, async ({ page }) => {
            await page.goto(
                '/tests/independent-transforms/layout-user-transform?@isPlaywright=true'
            )
            await page.locator('#user-motion').waitFor({ state: 'attached' })
            // `#user-waapi`'s 1s animation has finished (held by fill: forwards);
            // `#user-motion`'s 4s one is still in flight.
            await page.waitForTimeout(1300)

            const samples = await page.evaluate(() =>
                (window as unknown as UserTransformWindow).widenAndSample(10)
            )
            const ys = samples[id]

            expect(ys.length).toBe(10)
            expect(
                Math.max(...ys.map((y) => Math.abs(y))),
                `#${id} projection translateY per frame ${JSON.stringify(ys)}`
            ).toBeLessThanOrEqual(1)
        })
    }

    /**
     * Once `#user-motion`'s `animate(el, { transform })` has finished, its
     * `translateY(40px)` is just an inline style, like `#user-inline`'s.
     * Upstream `resetTransform()` (motion-dom `create-projection-node.ts`
     * @ `v14.2.0`, 999-1031) only rewrites the inline transform for a layout
     * read when the node has a projection delta, Motion transform values
     * (`hasTransform(latestValues)`) or a changed `transformTemplate`.
     *
     * Measured on the React fixture (`dev/react-19`, Motion 14.2.0, same 4s
     * animate + 1s linear layout): the box paints at its natural row from the
     * first frame of the change, projection translateY is 0 on every frame,
     * and the final inline transform is `none`. The layout reads agree, so
     * there's no vertical delta, and the projection's own write replaces the
     * inline value (`applyProjectionStyles`, 2066-2076; `'none'` once idle,
     * 2050-2055).
     */
    for (const [id, natural] of [
        ['user-motion', 100],
        ['user-inline', 200]
    ] as const) {
        test(`widening #${id} after its transform settled inline drops it into its row in one frame`, async ({
            page
        }) => {
            await page.goto(
                '/tests/independent-transforms/layout-user-transform?@isPlaywright=true'
            )
            const motionBox = page.locator('#user-motion')
            await motionBox.waitFor({ state: 'attached' })
            // Wait out the 4s animation: committed inline, nothing attached.
            await expect
                .poll(
                    () =>
                        motionBox.evaluate((el) => ({
                            transform: el.style.transform,
                            animations: el.getAnimations().length
                        })),
                    { timeout: 8000 }
                )
                .toEqual({ transform: 'translateY(40px)', animations: 0 })

            const samples = await page.evaluate(() =>
                (window as unknown as UserTransformWindow).widenAndSampleTops(1300)
            )
            const { before, after } = samples[id]
            const trace = `#${id} [top, projection y] per frame ${JSON.stringify(
                after.map((frame) => [frame.top, frame.y])
            )}`

            expect(before.top).toBeCloseTo(natural + 40, 0)
            expect(after.length).toBeGreaterThan(30)
            for (const frame of after) {
                expect(Math.abs(frame.top - natural), trace).toBeLessThanOrEqual(1)
                expect(Math.abs(frame.y), trace).toBeLessThanOrEqual(1)
            }
            expect(after.at(-1)!.transform).toBe('none')
        })
    }

    /**
     * `#user-y` is offset by `animate(el, { y: 40 })`, a Motion value. The
     * projection composes it (`buildProjectionTransform(…, latestValues)`,
     * `create-projection-node.ts` @ `v14.2.0`, 2066-2076). React fixture
     * (Motion 14.2.0, same widen): painted top +40px on every frame, final
     * inline `translate3d(0px, 40px, 0px)`.
     */
    test('widening #user-y (Motion y value) keeps it 40px down on every frame', async ({
        page
    }) => {
        await page.goto('/tests/independent-transforms/layout-user-transform?@isPlaywright=true')
        const yBox = page.locator('#user-y')
        await yBox.waitFor({ state: 'attached' })
        await expect
            .poll(() => yBox.evaluate((el) => el.getBoundingClientRect().top), { timeout: 5000 })
            .toBeCloseTo(340, 0)
        await page.waitForTimeout(200)

        const samples = await page.evaluate(() =>
            (window as unknown as UserTransformWindow).widenAndSampleTops(1300)
        )
        const { before, after } = samples['user-y']
        const trace = `#user-y [top, transform] per frame ${JSON.stringify(
            after.map((frame) => [frame.top, frame.transform])
        )}`

        expect(before.top).toBeCloseTo(340, 0)
        expect(after.length).toBeGreaterThan(30)
        for (const frame of after) {
            expect(Math.abs(frame.top - 340), trace).toBeLessThanOrEqual(1)
        }
    })

    /**
     * `#user-declarative` gets `translateY(40px)` from a declarative
     * `animate={{ transform }}` (4s linear). The `transform` key renders
     * inline as-is (`buildHTMLStyles`, motion-dom
     * `render/html/utils/build-styles.ts` @ `v14.2.0`, 30-47 and 52) and isn't
     * an independent transform (`has-transform.ts`, 16-27), so upstream
     * `resetTransform()` keeps it for the layout reads
     * (`create-projection-node.ts`, 999-1031).
     *
     * React fixture (Motion 14.2.0, same props, widened after the slide):
     * before top +40; from the first frame of the change painted at its row
     * (top 0) on every frame, width growing 101 → 300 over the 1s layout
     * transition, final inline `none`.
     */
    test('widening #user-declarative after its declarative transform finished drops it into its row and animates the width', async ({
        page
    }) => {
        await page.goto('/tests/independent-transforms/layout-user-transform?@isPlaywright=true')
        const box = page.locator('#user-declarative')
        await box.waitFor({ state: 'attached' })
        await expect
            .poll(
                () =>
                    box.evaluate((el) => ({
                        transform: el.style.transform,
                        animations: el.getAnimations().length
                    })),
                { timeout: 8000 }
            )
            .toEqual({ transform: 'translateY(40px)', animations: 0 })

        const samples = await page.evaluate(() =>
            (window as unknown as UserTransformWindow).widenAndSampleTops(1300)
        )
        const { before, after } = samples['user-declarative'] as {
            before: DeclarativeFrame
            after: DeclarativeFrame[]
        }
        const trace = `#user-declarative [top, width] per frame ${JSON.stringify(
            after.map((frame) => [frame.top, frame.width])
        )}`

        expect(before.top).toBeCloseTo(440, 0)
        expect(before.width).toBeCloseTo(100, 0)
        expect(after.length).toBeGreaterThan(30)
        for (const frame of after) {
            expect(Math.abs(frame.top - 400), trace).toBeLessThanOrEqual(1)
        }
        // The width change is a layout animation, not a snap.
        expect(after[0].width, trace).toBeLessThan(150)
        for (let i = 1; i < after.length; i++) {
            expect(after[i].width, trace).toBeGreaterThanOrEqual(after[i - 1].width - 0.5)
        }
        expect(
            after.some((frame) => frame.width > 150 && frame.width < 250),
            trace
        ).toBe(true)
        expect(after.at(-1)!.width).toBeCloseTo(300, 0)
        expect(after.at(-1)!.transform).toBe('none')
    })

    /**
     * Widened mid-slide. Upstream demotes only Motion's independent-transform
     * group (`create-projection-node.ts` @ `v14.2.0`, 123-124), and a
     * `transform` animation isn't in it, so the compositor animation keeps
     * painting over the projection's inline transform.
     *
     * React fixture (Motion 14.2.0, same props, widened 1.3s in): the box
     * keeps sliding down from +13.6px with no jump (about 0.17px a frame) and
     * paints 300px wide from the first frame; when the 4s slide ends it drops
     * from +39.9px to its row (top 0) in one frame and stays there, inline
     * `none` (`applyProjectionStyles`, 2050-2055).
     */
    test('widening #user-declarative mid-slide keeps it sliding, then drops it into its row when the slide ends', async ({
        page
    }) => {
        await page.goto('/tests/independent-transforms/layout-user-transform?@isPlaywright=true')
        const box = page.locator('#user-declarative')
        await box.waitFor({ state: 'attached' })
        await page.waitForTimeout(1300)
        expect(await box.evaluate((el) => el.getAnimations().length)).toBe(1)

        const samples = await page.evaluate(() =>
            (window as unknown as UserTransformWindow).widenAndSampleTops(3500)
        )
        const { before, after } = samples['user-declarative'] as {
            before: DeclarativeFrame
            after: DeclarativeFrame[]
        }
        const trace = `#user-declarative [top, width] per frame ${JSON.stringify(
            after.map((frame) => [frame.top, frame.width])
        )}`

        expect(before.top, trace).toBeGreaterThan(405)
        expect(before.top, trace).toBeLessThan(430)
        const landed = after.findIndex((frame) => Math.abs(frame.top - 400) <= 1)
        expect(landed, trace).toBeGreaterThan(30)
        const sliding = after.slice(0, landed)
        let previous = before.top
        for (const frame of sliding) {
            expect(frame.top - previous, trace).toBeGreaterThanOrEqual(-0.2)
            expect(frame.top - previous, trace).toBeLessThanOrEqual(2)
            expect(Math.abs(frame.width - 300), trace).toBeLessThanOrEqual(1)
            previous = frame.top
        }
        expect(sliding.at(-1)!.top, trace).toBeGreaterThan(437)
        for (const frame of after.slice(landed)) {
            expect(Math.abs(frame.top - 400), trace).toBeLessThanOrEqual(1)
            expect(Math.abs(frame.width - 300), trace).toBeLessThanOrEqual(1)
        }
        expect(after.at(-1)!.transform).toBe('none')
    })

    /**
     * A commit that moves nothing ends a finished projection. Upstream, a
     * finished layout animation keeps its `target` (`completeAnimation`,
     * motion-dom `create-projection-node.ts` @ `v14.2.0`, 1791-1805), so later
     * renders keep projecting and write `none` (2059-2075). A React re-render
     * whose layout didn't change runs `didUpdate` → `finishAnimation`
     * (615-617, 2445-2448), which clears the target, so each box's own
     * transform renders again (2042-2055 no longer overwrite it).
     *
     * React fixture (Motion 14.2.0, same boxes, widened 1.3s in, one
     * re-render with no layout change 1.7s after the widen): boxes 2 and 5
     * end 40px down with inline `translateY(40px)` when their slides end, box
     * 3 stays in its row, box 4 stays 40px down and its inline value turns
     * from `translate3d(0px, 40px, 0px)` into `translateY(40px)`. Here the
     * re-render is a colour-only `style` commit (`recolor`).
     */
    test('a commit that moves nothing after the layout animation lets each box’s own transform render again', async ({
        page
    }) => {
        await page.goto('/tests/independent-transforms/layout-user-transform?@isPlaywright=true')
        const motionBox = page.locator('#user-motion')
        await motionBox.waitFor({ state: 'attached' })
        await page.waitForTimeout(1300)
        expect(await motionBox.evaluate((el) => el.getAnimations().length)).toBe(1)

        const samples = await page.evaluate(() => {
            const target = window as unknown as UserTransformWindow & { recolor: () => void }
            // The 1s layout transition has ended by then; the slides haven't.
            setTimeout(() => target.recolor(), 1700)
            return target.widenAndSampleTops(5500)
        })
        // Both 4s slides have ended and committed by the last frame.
        expect(await motionBox.evaluate((el) => el.getAnimations().length)).toBe(0)
        const trace = Object.entries(samples)
            .map(
                ([id, { after }]) =>
                    `#${id} [top, transform] ${JSON.stringify(
                        after.slice(-3).map((frame) => [frame.top, frame.transform])
                    )}`
            )
            .join('\n')

        for (const [id, top] of [
            ['user-motion', 140],
            ['user-inline', 200],
            ['user-y', 340],
            ['user-declarative', 440]
        ] as const) {
            expect(Math.abs(samples[id].after.at(-1)!.top - top), trace).toBeLessThanOrEqual(1)
        }
        expect(samples['user-motion'].after.at(-1)!.transform, trace).toBe('translateY(40px)')
        expect(samples['user-declarative'].after.at(-1)!.transform, trace).toBe('translateY(40px)')
        expect(samples['user-y'].after.at(-1)!.transform, trace).toBe('translateY(40px)')
    })

    /** Tester mode: the recolor scenario judges boxes 2, 4 and 5 and ends PASS. */
    test('the recolor tester scenario URL ends with its rows PASS', async ({ page }) => {
        test.setTimeout(60_000)
        await page.setViewportSize({ width: 1920, height: 1000 })
        await page.goto(
            '/tests/independent-transforms/layout-user-transform?scenario=recolor-mid-slide'
        )
        for (const key of ['user-motion-recolor', 'user-y-recolor', 'user-declarative-recolor']) {
            await expect(page.locator(`[data-tester-verdict="${key}"] .chip`), key).toHaveText(
                'PASS',
                { timeout: 15_000 }
            )
        }
        await expect(page.locator('[data-tester-verdict="user-waapi"] .chip')).toHaveText('not run')
    })

    /**
     * Tester mode (no `@isPlaywright`): each `?scenario=` load counts down,
     * widens once and judges only its own rows; the other scenarios' rows
     * read "not run".
     */
    test('each tester scenario URL runs on its own and ends with its rows PASS', async ({
        page
    }) => {
        test.setTimeout(90_000)
        await page.setViewportSize({ width: 1920, height: 1000 })
        const rows = {
            'mid-slide': ['user-waapi', 'user-motion'],
            'after-finish': [
                'user-motion-after-finish',
                'user-inline-after-finish',
                'user-y-after-finish',
                'user-declarative-after-finish'
            ],
            'declarative-mid-slide': ['user-declarative-mid-slide']
        } as const
        for (const [scenario, keys] of Object.entries(rows)) {
            await page.goto(
                `/tests/independent-transforms/layout-user-transform?scenario=${scenario}`
            )
            for (const key of keys) {
                await expect(
                    page.locator(`[data-tester-verdict="${key}"] .chip`),
                    `${scenario}: ${key}`
                ).toHaveText('PASS', { timeout: 15_000 })
            }
            for (const [other, otherKeys] of Object.entries(rows)) {
                if (other === scenario) continue
                for (const key of otherKeys) {
                    await expect(
                        page.locator(`[data-tester-verdict="${key}"] .chip`),
                        `${scenario}: ${key}`
                    ).toHaveText('not run')
                }
            }
            await expect(page.locator('[data-tester-scenario]').first()).toBeEnabled()
        }
    })
})
