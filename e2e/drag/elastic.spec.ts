import { expect, test } from '@playwright/test'

test.describe('drag/elastic', () => {
    const expectElasticReleaseSpringsBack = async (
        page: import('@playwright/test').Page,
        testId: string
    ) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')

        const box = page.getByTestId(testId)
        await box.waitFor({ state: 'visible' })
        await page.waitForSelector(`[data-testid="${testId}"][data-is-loaded="ready"]`)
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        const startX = start.x + start.width / 2
        const startY = start.y + start.height / 2
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        for (let i = 1; i <= 8; i++) {
            await page.mouse.move(startX + i * 35, startY, { steps: 1 })
            await page.waitForTimeout(16)
        }
        await page.waitForTimeout(80)

        const active = await box.boundingBox()
        if (!active) throw new Error('no active')
        const activeDx = active.x - start.x
        expect(activeDx).toBeGreaterThan(60)

        const releaseSamplesPromise = page.evaluate((id) => {
            return new Promise<Array<{ t: number; x: number }>>((resolve) => {
                const node = document.querySelector(`[data-testid="${id}"]`)
                if (!(node instanceof HTMLElement)) {
                    resolve([])
                    return
                }
                const startedAt = performance.now()
                const samples: Array<{ t: number; x: number }> = []
                const tick = () => {
                    const rect = node.getBoundingClientRect()
                    samples.push({
                        t: Math.round(performance.now() - startedAt),
                        x: Math.round(rect.x * 100) / 100
                    })
                    if (performance.now() - startedAt < 1000) {
                        requestAnimationFrame(tick)
                    } else {
                        resolve(samples)
                    }
                }
                requestAnimationFrame(tick)
            })
        }, testId)
        await page.mouse.up()
        const releaseSamples = await releaseSamplesPromise

        const final = await box.boundingBox()
        if (!final) throw new Error('no final')
        const finalDx = final.x - start.x
        expect(finalDx).toBeGreaterThanOrEqual(28)
        expect(finalDx).toBeLessThanOrEqual(32)

        const first = releaseSamples[0]?.x
        const second = releaseSamples[1]?.x
        const boundaryX = start.x + 30
        expect(first).toBeLessThanOrEqual(active.x + 1)
        expect(second).toBeGreaterThan(boundaryX + 5)
        expect(
            releaseSamples.some((sample) => sample.x < active.x - 10 && sample.x > boundaryX + 5)
        ).toBe(true)
        expect(new Set(releaseSamples.map((sample) => Math.round(sample.x))).size).toBeGreaterThan(
            3
        )
    }

    test('elastic=0.5 springs back over multiple frames after overdrag release', async ({
        page
    }) => {
        await expectElasticReleaseSpringsBack(page, 'elastic-05')
    })

    test('elastic=1 springs back over multiple frames after overdrag release', async ({ page }) => {
        await expectElasticReleaseSpringsBack(page, 'elastic-1')
    })

    test('elastic=0 multiple drags never exceed +30 bound', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')

        const box = page.getByTestId('elastic-0')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        const containerCenterX = start.x + start.width / 2

        const dragRelease = async () => {
            const bb = await box.boundingBox()
            if (!bb) throw new Error('no bb')
            await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
            await page.mouse.down()
            await page.mouse.move(bb.x + bb.width / 2 + 200, bb.y + bb.height / 2, { steps: 5 })
            await page.mouse.up()
            await page.waitForTimeout(400)
            const after = await box.boundingBox()
            if (!after) throw new Error('no after')
            const centerX = after.x + after.width / 2
            const dx = centerX - containerCenterX
            expect(dx).toBeGreaterThanOrEqual(28)
            expect(dx).toBeLessThanOrEqual(32)
        }

        await dragRelease()
        await dragRelease()
        await dragRelease()
    })

    test('elastic=0 clamps exactly to ±30', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')
        const el = page.getByTestId('elastic-0')
        await el.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.mouse.move(s.x + 300, s.y + 10, { steps: 10 })
        await page.mouse.up()

        // Give CI a little longer to settle and snap exactly to clamp
        await page.waitForTimeout(350)
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        const dx = Math.round(e.x - s.x)
        expect(dx).toBeGreaterThanOrEqual(28)
        expect(dx).toBeLessThanOrEqual(32)
    })

    test('object elastic applies per-edge overdrag', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')
        const el = page.getByTestId('elastic-right-only')
        await el.waitFor({ state: 'visible' })
        const start = await el.boundingBox()
        if (!start) throw new Error('no start')

        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 200, cy, { steps: 8 })
        const rightActive = await el.boundingBox()
        if (!rightActive) throw new Error('no rightActive')
        expect(rightActive.x - start.x).toBeGreaterThan(80)
        await page.mouse.up()
        await page.waitForTimeout(600)

        const settled = await el.boundingBox()
        if (!settled) throw new Error('no settled')
        const settledCx = settled.x + settled.width / 2
        const settledCy = settled.y + settled.height / 2
        await page.mouse.move(settledCx, settledCy)
        await page.mouse.down()
        await page.mouse.move(settledCx - 200, settledCy, { steps: 8 })
        const leftActive = await el.boundingBox()
        if (!leftActive) throw new Error('no leftActive')
        expect(leftActive.x - start.x).toBeGreaterThanOrEqual(-32)
        expect(leftActive.x - start.x).toBeLessThanOrEqual(-28)
        await page.mouse.up()
    })

    test('elastic=0 (no overdrag) settles without visible bounce', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')

        const box = page.getByTestId('elastic-0')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        await page.mouse.move(start.x + 10, start.y + 10)
        await page.mouse.down()
        await page.mouse.move(start.x + 10 + 120, start.y + 10, { steps: 5 })
        await page.mouse.up()

        const samples: number[] = []
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(60)
            const bb = await box.boundingBox()
            if (bb) samples.push(bb.x)
        }
        const diffs = samples.slice(1).map((x, i) => Math.abs(x - samples[i]))
        const maxDelta = Math.max(0, ...diffs)
        expect(maxDelta).toBeLessThan(2)
    })

    test('second drag respects click point after elastic settle and clamps within bounds', async ({
        page
    }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')

        const box = page.getByTestId('elastic-05')
        await box.waitFor({ state: 'visible' })
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // First drag
        await page.mouse.move(start.x + 10, start.y + 10)
        await page.mouse.down()
        await page.mouse.move(start.x + 120, start.y + 10, { steps: 5 })
        await page.mouse.up()

        await page.waitForTimeout(400)
        const settled1 = await box.boundingBox()
        if (!settled1) throw new Error('no settled1')

        // Second drag - start by moving to element
        await page.mouse.move(settled1.x + 10, settled1.y + 10)
        await page.mouse.down()

        const afterDown = await box.boundingBox()
        if (!afterDown) throw new Error('no afterDown')
        expect(Math.abs(afterDown.x - settled1.x)).toBeLessThan(1.5)

        const LIMIT = 30
        await page.mouse.move(settled1.x + 10 + 200, settled1.y + 10, { steps: 5 })
        await page.mouse.up()

        let lastX = NaN
        let stableCount = 0
        for (let i = 0; i < 30; i++) {
            await page.waitForTimeout(50)
            const bb = await box.boundingBox()
            if (!bb) continue
            if (!Number.isNaN(lastX) && Math.abs(bb.x - lastX) < 0.5) {
                stableCount++
                if (stableCount >= 3) break
            } else {
                stableCount = 0
            }
            lastX = bb.x
        }

        const finalBB = await box.boundingBox()
        if (!finalBB) throw new Error('no finalBB')
        const absClamp = Math.round(finalBB.x - start.x)
        expect(absClamp).toBeGreaterThanOrEqual(LIMIT - 2)
        expect(absClamp).toBeLessThanOrEqual(LIMIT + 2)
    })

    test('second drag clamps from new origin', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')
        const el = page.getByTestId('elastic-0')
        await el.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')

        // First drag
        await page.mouse.move(s.x + 10, s.y + 10)
        await page.mouse.down()
        await page.mouse.move(s.x + 300, s.y + 10, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(200)

        const mid = await el.boundingBox()
        if (!mid) throw new Error('no mid')

        // Second drag
        await page.mouse.move(mid.x + 10, mid.y + 10)
        await page.mouse.down()
        await page.mouse.move(mid.x + 300, mid.y + 10, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(200)

        const end = await el.boundingBox()
        if (!end) throw new Error('no end')
        // With pixel constraints anchored to base 0, the element's absolute x will continue to be clamped to +30.
        // The delta from mid may be 0 if both clamps resolve to the same absolute bound. Assert absolute clamp.
        const absClamp = Math.round(end.x - s.x)
        expect(absClamp).toBeGreaterThanOrEqual(28)
        expect(absClamp).toBeLessThanOrEqual(32)
    })
})
