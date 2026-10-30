import { expect, test, type Page } from '@playwright/test'

/**
 * A `layout` element at rest keeps the browser's default `transform-origin`
 * (the centre) and gets no `will-change: transform`, matching Motion 14.7.1,
 * whose only layout writer of `transform-origin` is the projection while it
 * projects a delta (`create-projection-node.ts:2119`, default `50% 50% 0`).
 *
 * The scale cases are proven per painted frame: an in-page rAF loop hit-tests
 * two probe points fixed before the animation starts with
 * `document.elementFromPoint`, which forces style and layout for the frame
 * about to paint. The rect readout is supporting evidence only.
 */

const BASE = '/tests/layout/transform-origin-at-rest'

type FrameProbe = {
    frames: number
    /** Frames where the resting centre did not hit the box (must be 0). */
    centreMisses: number
    /** Frames with widthRatio < 0.6 where the corner still hit the box (must be 0). */
    cornerHitsWhileSmall: number
    /** Frames with widthRatio < 0.6 (must be > 0: proves the scale ran). */
    smallFrames: number
    /** Rect evidence: largest centre drift in px. */
    maxDrift: number
    /** Rect evidence: smallest width / resting width. */
    minWidthRatio: number
}

const gotoPage = async (page: Page, query = ''): Promise<void> => {
    await page.goto(`${BASE}?@isPlaywright=true${query}`)
    await page.waitForFunction(() => window.MotionIsMounted === true)
    // Let the layout observers settle.
    await page.waitForTimeout(300)
}

/**
 * Hit-tests and measures `selector` once per frame for `ms` after `trigger`
 * is clicked. The click and the first rAF are queued in the same task, so
 * every probe runs after motion-dom's frameloop has written that frame.
 *
 * @param page Playwright page.
 * @param selector The element to probe each frame (the clone, for a clone exit).
 * @param restSelector The live element whose rect, read before the click, is the resting box.
 * @param trigger `data-testid` of the button to click.
 * @param ms How long to probe.
 * @returns Per-frame hit counts plus rect evidence.
 */
const probeFrames = (
    page: Page,
    selector: string,
    restSelector: string,
    trigger: string,
    ms = 900
): Promise<FrameProbe> =>
    page.evaluate(
        ([selector, restSelector, trigger, ms]) =>
            new Promise<FrameProbe>((resolve) => {
                const query = () => document.querySelector<HTMLElement>(selector)
                const restEl = document.querySelector<HTMLElement>(restSelector)!
                // `elementFromPoint` only hit-tests inside the viewport, so bring
                // the resting box into view before fixing the probe points.
                restEl.scrollIntoView({ block: 'center' })
                const rest = restEl.getBoundingClientRect()
                const cx = rest.left + rest.width / 2
                const cy = rest.top + rest.height / 2
                // 4px in from the resting top-left corner.
                const kx = rest.left + 4
                const ky = rest.top + 4
                const out: FrameProbe = {
                    frames: 0,
                    centreMisses: 0,
                    cornerHitsWhileSmall: 0,
                    smallFrames: 0,
                    maxDrift: 0,
                    minWidthRatio: 1
                }
                const start = performance.now()
                const tick = () => {
                    const el = query()
                    if (el) {
                        // Exiting clones carry inline `pointer-events: none` and
                        // `inert` (presence.ts), which hide them from hit-testing.
                        // Neither changes what is painted, so turn both off.
                        if (el.style.pointerEvents === 'none') el.style.pointerEvents = 'auto'
                        if (el.inert) el.inert = false
                        const hits = (x: number, y: number) => {
                            const hit = document.elementFromPoint(x, y)
                            return !!hit && (hit === el || el.contains(hit))
                        }
                        const r = el.getBoundingClientRect()
                        const ratio = r.width / rest.width
                        out.frames++
                        if (!hits(cx, cy)) out.centreMisses++
                        if (ratio < 0.6) {
                            out.smallFrames++
                            if (hits(kx, ky)) out.cornerHitsWhileSmall++
                        }
                        out.maxDrift = Math.max(
                            out.maxDrift,
                            Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
                        )
                        out.minWidthRatio = Math.min(out.minWidthRatio, ratio)
                    }
                    if (performance.now() - start < ms) requestAnimationFrame(tick)
                    else resolve(out)
                }
                document.querySelector<HTMLElement>(`[data-testid="${trigger}"]`)!.click()
                requestAnimationFrame(tick)
            }),
        [selector, restSelector, trigger, ms] as const
    )

/**
 * Asserts a probe saw a centre-origin scale on every frame.
 *
 * @param probe The probe result.
 */
const expectCentred = (probe: FrameProbe): void => {
    // With a centre origin the resting centre stays inside the box at every
    // scale. A `0 0` origin shrinks the box into its top-left quadrant, so the
    // centre stops hitting once scale drops below 0.5.
    expect(probe.centreMisses, JSON.stringify(probe)).toBe(0)
    // With a centre origin the 4px corner probe leaves the box once it is
    // below ~0.93 of its height, so it can never hit while width < 0.6. A
    // `0 0` origin keeps the corner pinned and always hits.
    expect(probe.cornerHitsWhileSmall, JSON.stringify(probe)).toBe(0)
    // The linear 0.8 s scale to 0.4 spends ~0.27 s below 0.6: well over 3 frames.
    expect(probe.smallFrames, JSON.stringify(probe)).toBeGreaterThan(3)
    // A 900 ms window at 60 Hz is ~54 frames; > 10 proves the loop ran.
    expect(probe.frames, JSON.stringify(probe)).toBeGreaterThan(10)
    // Rect evidence: a centre origin keeps the centre put (sub-pixel only).
    // A `0 0` origin drifts by up to (1 − 0.4) × hypot(100, 60) ≈ 70px.
    expect(probe.maxDrift, JSON.stringify(probe)).toBeLessThanOrEqual(1)
    expect(probe.minWidthRatio, JSON.stringify(probe)).toBeLessThan(0.6)
}

test.describe('layout transform-origin at rest', () => {
    test('fresh layout box scales about its centre', async ({ page }) => {
        await gotoPage(page)
        const probe = await probeFrames(
            page,
            '[data-testid="fresh-box"]',
            '[data-testid="fresh-box"]',
            'scale-fresh'
        )
        expectCentred(probe)
    })

    test('settled layout box scales about its centre after a layout animation', async ({
        page
    }) => {
        await gotoPage(page)
        await page.getByTestId('move-settled').click()
        // The 0.8 s layout animation finishes well inside this.
        await page.waitForTimeout(1200)
        const probe = await probeFrames(
            page,
            '[data-testid="settled-box"]',
            '[data-testid="settled-box"]',
            'scale-settled'
        )
        expectCentred(probe)
    })

    test('popLayout exit with scale shrinks about its centre (owned)', async ({ page }) => {
        await gotoPage(page, '&path=owned')
        const probe = await probeFrames(
            page,
            '[data-testid="pop-box"]',
            '[data-testid="pop-box"]',
            'exit-pop'
        )
        expectCentred(probe)
    })

    test('popLayout exit with scale shrinks about its centre (clone)', async ({ page }) => {
        await gotoPage(page, '&path=clone')
        const probe = await probeFrames(
            page,
            '[data-testid="pop-box"][data-clone="true"]',
            '[data-testid="pop-box"]',
            'exit-pop'
        )
        expectCentred(probe)
    })

    test('fixed child of a layout element is positioned against the viewport', async ({ page }) => {
        await gotoPage(page)
        const result = await page.evaluate(() => {
            const child = document.querySelector<HTMLElement>('[data-testid="fixed-child"]')!
            const r = child.getBoundingClientRect()
            return {
                left: r.left,
                top: r.top,
                // Hit-test the painted page: the child must cover the window's corner.
                hitIsChild: document.elementFromPoint(5, 5) === child
            }
        })
        // `will-change: transform` on the host would make the host the child's
        // containing block and put it at the host's corner (~40px in).
        expect(Math.abs(result.left), JSON.stringify(result)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(result.top), JSON.stringify(result)).toBeLessThanOrEqual(0.5)
        expect(result.hitIsChild, JSON.stringify(result)).toBe(true)
    })

    test('layout element at rest has no inline top-left origin or will-change', async ({
        page
    }) => {
        await gotoPage(page)
        const style = await page.getByTestId('fresh-box').evaluate((el) => ({
            transformOrigin: (el as HTMLElement).style.transformOrigin,
            willChange: (el as HTMLElement).style.willChange
        }))
        expect(style.transformOrigin).not.toMatch(/^0(px)? 0(px)?/)
        expect(style.willChange).not.toBe('transform')
    })
})
