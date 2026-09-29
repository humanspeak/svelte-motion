import { expect, test, type Locator } from '@playwright/test'

/**
 * Port of upstream `packages/framer-motion/cypress/integration/layout-shared.ts`
 * → "Shared layout: component unmounts in a LayoutGroup" (Motion v13.4.5)
 * against `/tests/layout/layout-group-unmount` and
 * `/tests/layout/layout-group-unmount-list`.
 */
interface BoundingBox {
    top: number
    left: number
    width: number
    height: number
}

const bbox = (locator: Locator): Promise<BoundingBox> =>
    locator.evaluate((element) => {
        const { top, left, width, height } = element.getBoundingClientRect()
        return { top, left, width, height }
    })

/** Upstream's `expectBbox`: exact equality on left / top / width / height. */
async function expectBbox(locator: Locator, expected: BoundingBox) {
    await expect.poll(() => bbox(locator)).toEqual(expected)
}

test.describe('Shared layout: component unmounts in a LayoutGroup', () => {
    test('Should trigger sibling animation when unmount', async ({ page }) => {
        await page.goto('/tests/layout/layout-group-unmount?@isPlaywright=true')
        await page.waitForTimeout(50)
        await page.locator('#a').dispatchEvent('click')
        await page.waitForTimeout(50)
        await expectBbox(page.locator('#b'), {
            top: 90,
            left: 20,
            width: 100,
            height: 100
        })
    })

    test("If a sibling's position relative to the parent has changed, it should remain at its position", async ({
        page
    }) => {
        await page.goto('/tests/layout/layout-group-unmount-list?@isPlaywright=true')
        await page.waitForTimeout(50)
        const initial = await bbox(page.locator('#b'))
        await page.locator('#a').dispatchEvent('click')
        await page.waitForTimeout(50)
        await expectBbox(page.locator('#b'), initial)
    })
})

/**
 * Plan 007 D7 against `/tests/layout/layout-group-presence`: upstream
 * AnimatePresence calls the nearest LayoutGroup's `forceRender` once every
 * exit completes, so a `layout` sibling animates into the freed space. The
 * port must animate it (intermediate frames) and animate it once: a second
 * commit of the same change would restart the animation and show up as a
 * backward jump in #b's per-frame position.
 */
test.describe('LayoutGroup + AnimatePresence: exit completes', () => {
    test('a layout sibling holds its slot while the exit is still running', async ({ page }) => {
        await page.goto('/tests/layout/layout-group-presence?@isPlaywright=true')
        await page.locator('#b').waitFor({ state: 'visible' })
        await page.waitForTimeout(250)

        const start = (await bbox(page.locator('#b'))).top
        // Sample #b every frame from the click until 250ms in — #a's exit
        // runs 300ms, so its (placeholder-held) slot must not collapse yet.
        const tops = await page.evaluate(
            () =>
                new Promise<number[]>((resolve) => {
                    const b = document.getElementById('b')!
                    const samples: number[] = []
                    const t0 = performance.now()
                    const record = () => {
                        samples.push(b.getBoundingClientRect().top)
                        if (performance.now() - t0 < 250) requestAnimationFrame(record)
                        else resolve(samples)
                    }
                    document
                        .getElementById('a')!
                        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
                    requestAnimationFrame(record)
                })
        )

        expect(tops.length).toBeGreaterThan(5)
        for (const [i, top] of tops.entries()) {
            expect(
                Math.abs(top - start),
                `frame ${i} (start ${start}): ${tops.map(Math.round).join(',')}`
            ).toBeLessThanOrEqual(0.5)
        }
    })

    test('a layout sibling animates into the freed space exactly once', async ({ page }) => {
        await page.goto('/tests/layout/layout-group-presence?@isPlaywright=true')
        await page.locator('#b').waitFor({ state: 'visible' })
        await page.waitForTimeout(250)

        const start = (await bbox(page.locator('#b'))).top
        await page.evaluate(() => {
            const w = window as unknown as { __tops: number[] }
            const b = document.getElementById('b')!
            w.__tops = []
            const record = () => {
                w.__tops.push(b.getBoundingClientRect().top)
                requestAnimationFrame(record)
            }
            record()
            document.getElementById('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await expect.poll(async () => (await bbox(page.locator('#b'))).top).toBe(20)
        const tops = await page.evaluate(() => [
            ...(window as unknown as { __tops: number[] }).__tops
        ])

        // Animated: many distinct positions strictly between start and end.
        const between = new Set(
            tops.filter((top) => top < start - 1 && top > 21).map((top) => Math.round(top))
        )
        expect(between.size, `tops: ${tops.map(Math.round).join(',')}`).toBeGreaterThan(10)
        // Once: #b only ever moves toward its new slot (no restart).
        for (let i = 1; i < tops.length; i++) {
            expect(tops[i], `frame ${i}: ${tops.map(Math.round).join(',')}`).toBeLessThanOrEqual(
                tops[i - 1] + 0.5
            )
        }
    })
})
