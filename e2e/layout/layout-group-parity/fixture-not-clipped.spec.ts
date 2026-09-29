import { expect, test } from '@playwright/test'

/**
 * Paint-level regression for the parity fixtures' top-left anchoring.
 *
 * `src/app.html`'s `<body>` is a scroll container (`overflow: auto`). The
 * parity pages anchor their fixture top-left by overriding `.container` /
 * `#sandbox` to `display: block`; if they also drop `.container`'s
 * `min-height`, body shrinks to the content height and clips everything
 * painted below it. On `/tests/layout/layout-group-presence` that hid #b
 * (still drawn at its old slot via its FLIP transform) for ~150ms after #a
 * unmounted, then painted it as a sliver pinned to body's bottom edge.
 *
 * `getBoundingClientRect` doesn't see the clip, but hit testing does: a
 * clipped region is not hit-testable, so `elementFromPoint` at #b's visual
 * center must return #b whenever that center is inside the viewport.
 */
test.describe('Parity fixture is not clipped by a collapsed body', () => {
    test('#b stays hit-testable at its visual center through the exit + layout animation', async ({
        page
    }) => {
        await page.goto('/tests/layout/layout-group-presence?@isPlaywright=true')
        await page.locator('#b').waitFor({ state: 'visible' })
        await page.waitForTimeout(250)

        await page.locator('#a').click()

        const misses = await page.evaluate(
            () =>
                new Promise<string[]>((resolve) => {
                    const b = document.getElementById('b')!
                    const failures: string[] = []
                    const t0 = performance.now()
                    const check = () => {
                        const t = performance.now() - t0
                        const rect = b.getBoundingClientRect()
                        const x = rect.left + rect.width / 2
                        const y = rect.top + rect.height / 2
                        const inViewport =
                            x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight
                        if (inViewport) {
                            const hit = document.elementFromPoint(x, y)
                            if (!hit || !(hit === b || b.contains(hit))) {
                                const label = hit
                                    ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}`
                                    : 'null'
                                failures.push(
                                    `t=${t.toFixed(0)}ms center=(${x.toFixed(1)}, ${y.toFixed(1)}) hit=${label}`
                                )
                            }
                        }
                        if (t < 1400) requestAnimationFrame(check)
                        else resolve(failures)
                    }
                    requestAnimationFrame(check)
                })
        )

        expect(misses, misses.join('\n')).toEqual([])
    })

    test('no ancestor of #b is a scroll container shorter than the viewport', async ({ page }) => {
        await page.goto('/tests/layout/layout-group-presence?@isPlaywright=true')
        await page.locator('#b').waitFor({ state: 'visible' })
        await page.locator('#a').click()
        await expect(page.locator('#a')).toHaveCount(0)

        const shortScrollers = await page.evaluate(() => {
            const found: string[] = []
            let el = document.getElementById('b')!.parentElement
            while (el && el !== document.documentElement) {
                const { overflowX, overflowY } = getComputedStyle(el)
                const clips = [overflowX, overflowY].some((v) => v !== 'visible')
                const height = el.getBoundingClientRect().height
                if (clips && height < window.innerHeight) {
                    found.push(
                        `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} overflow=${overflowX}/${overflowY} height=${height} viewport=${window.innerHeight}`
                    )
                }
                el = el.parentElement
            }
            return found
        })

        expect(shortScrollers, shortScrollers.join('\n')).toEqual([])
    })
})
