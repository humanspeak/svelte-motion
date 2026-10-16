import { expect, test, type Page } from '@playwright/test'

/**
 * A layout change made in the first flush after a `layout` element mounts
 * animates, on a hydrated load and on a client-side navigation alike.
 *
 * Upstream: hydrate → `componentDidMount` → the parent's effect sets state →
 * a new commit → `getSnapshotBeforeUpdate` → `willUpdate()` (framer-motion
 * `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`
 * @ `v14.2.0`, 39-98). Against
 * `src/routes/tests/independent-transforms/layout-hydration/+page.svelte`.
 */

const ids = ['hydrate-mount', 'hydrate-effect'] as const
type PaintedWindow = { __paintedWidths: Record<string, number[]> }

/**
 * Samples both boxes' painted widths once per rendered frame from the first
 * frame of the document (ResizeObserver on a per-frame ticker, like
 * `_paintedFrames.ts`), so the frames around mount are included.
 */
const installSampler = (page: Page) =>
    page.addInitScript((boxIds: readonly string[]) => {
        const widths: Record<string, number[]> = {}
        for (const id of boxIds) widths[id] = []
        ;(window as unknown as PaintedWindow).__paintedWidths = widths
        const start = () => {
            const ticker = document.createElement('div')
            ticker.style.cssText =
                'position: fixed; left: -10px; top: -10px; width: 1px; height: 1px; visibility: hidden; pointer-events: none'
            document.body.appendChild(ticker)
            new ResizeObserver(() => {
                for (const id of boxIds) {
                    const el = document.getElementById(id)
                    if (el) widths[id].push(Math.round(el.getBoundingClientRect().width * 10) / 10)
                }
            }).observe(ticker)
            let wide = false
            const tick = () => {
                wide = !wide
                ticker.style.width = wide ? '2px' : '1px'
                requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        }
        if (document.body) start()
        else document.addEventListener('DOMContentLoaded', start)
    }, ids)

const readWidths = async (page: Page) => {
    // Past the 1s layout transition.
    await page.waitForTimeout(1500)
    return page.evaluate(() => (window as unknown as PaintedWindow).__paintedWidths)
}

const expectAnimated = (widths: number[], label: string) => {
    const trace = `${label} painted widths ${JSON.stringify(widths)}`
    expect(widths.length, trace).toBeGreaterThan(30)
    // Painted at 100px first, so the change has somewhere to animate from.
    expect(widths[0], trace).toBeLessThan(110)
    // 200px over 1s linear is ~3.3px per frame; a snap is 200px.
    let maxStep = 0
    for (let i = 1; i < widths.length; i++) {
        maxStep = Math.max(maxStep, Math.abs(widths[i] - widths[i - 1]))
    }
    expect(maxStep, trace).toBeLessThanOrEqual(40)
    expect(widths.filter((width) => width > 110 && width < 290).length, trace).toBeGreaterThan(10)
    expect(Math.abs(widths.at(-1)! - 300), trace).toBeLessThanOrEqual(2)
}

test.describe('layout change right after mount', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test('hydrated load (page.goto): both boxes animate', async ({ page }) => {
        await installSampler(page)
        await page.goto('/tests/independent-transforms/layout-hydration?@isPlaywright=true')
        const widths = await readWidths(page)
        for (const id of ids) expectAnimated(widths[id], `goto #${id}`)
    })

    /**
     * Tester mode on a load that hydrates before the first frame. A `resize`
     * before Motion's first `frame.read` has stored `innerWidth` finishes
     * every layout animation (root resize listener, motion-dom
     * `create-projection-node.ts` @ `v14.2.0`, 482-508), in React Motion too,
     * so the page reports that load as "not judged" instead of FAIL.
     *
     * Every `requestAnimationFrame` callback is held until the app has
     * hydrated (`#hydrate-mount` gets its inline style), so the first frame
     * comes after hydration, as on a reload in the sign-off browser.
     */
    for (const resize of [true, false]) {
        test(`tester mode, hydrated before the first frame, ${
            resize ? 'with' : 'without'
        } a resize: ${resize ? 'not judged' : 'PASS'}`, async ({ page }) => {
            await page.addInitScript((resize: boolean) => {
                const raf = window.requestAnimationFrame.bind(window)
                let held: FrameRequestCallback[] | null = []
                window.requestAnimationFrame = (callback) => {
                    if (!held) return raf(callback)
                    held.push(callback)
                    return 0
                }
                const release = () => {
                    if (!held) return
                    const queue = held
                    held = null
                    // Same size: the sign-off browser's resize doesn't change it.
                    if (resize) window.dispatchEvent(new Event('resize'))
                    for (const callback of queue) raf(callback)
                }
                new MutationObserver((records, observer) => {
                    if (
                        !records.some((record) => (record.target as Element).id === 'hydrate-mount')
                    )
                        return
                    observer.disconnect()
                    setTimeout(release, 50)
                }).observe(document, {
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style']
                })
            }, resize)
            await page.setViewportSize({ width: 1280, height: 800 })
            await page.goto('/tests/independent-transforms/layout-hydration')
            for (const id of ids) {
                const row = page.locator(`[data-tester-verdict="${id}"]`)
                await expect(row.locator('.chip'), id).toHaveText(resize ? 'not judged' : 'PASS', {
                    timeout: 5000
                })
                if (resize) await expect(row, id).toContainText('resize before the first frame')
            }
            const hint = page.locator('[data-tester-hint]')
            if (resize)
                await expect(hint).toContainText('Use step 2 (follow the link from the index)')
            else await expect(hint).toHaveCount(0)
        })
    }

    test('client-side navigation from the index: both boxes animate', async ({ page }) => {
        await installSampler(page)
        await page.goto('/?@isPlaywright=true')
        await page.getByRole('link', { name: 'Layout change right after hydration' }).click()
        await page.waitForURL(/layout-hydration/)
        const widths = await readWidths(page)
        for (const id of ids) expectAnimated(widths[id], `client nav #${id}`)
    })
})
