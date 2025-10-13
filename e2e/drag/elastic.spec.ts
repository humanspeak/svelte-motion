import { expect, test } from '@playwright/test'

test.describe('drag/elastic', () => {
    test('elastic=0 multiple drags never exceed +30 bound', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')

        const box = page.getByTestId('elastic-0')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        const containerCenterX = start.x + start.width / 2

        const dragRelease = async (id: number) => {
            const bb = await box.boundingBox()
            if (!bb) throw new Error('no bb')
            await box.dispatchEvent('pointerdown', {
                clientX: bb.x + bb.width / 2,
                clientY: bb.y + bb.height / 2,
                pointerId: id
            })
            await page.dispatchEvent('body', 'pointermove', {
                clientX: bb.x + bb.width / 2 + 200,
                clientY: bb.y + bb.height / 2,
                pointerId: id
            })
            await page.dispatchEvent('body', 'pointerup', {
                clientX: bb.x + bb.width / 2 + 200,
                clientY: bb.y + bb.height / 2,
                pointerId: id
            })
            await page.waitForTimeout(400)
            const after = await box.boundingBox()
            if (!after) throw new Error('no after')
            const centerX = after.x + after.width / 2
            const dx = centerX - containerCenterX
            expect(dx).toBeGreaterThanOrEqual(28)
            expect(dx).toBeLessThanOrEqual(32)
        }

        await dragRelease(31)
        await dragRelease(32)
        await dragRelease(33)
    })

    test('elastic=0 clamps exactly to ±30', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')
        const el = page.getByTestId('elastic-0')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 1
        })
        await page.waitForTimeout(200)
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        const dx = Math.round(e.x - s.x)
        expect(dx).toBeGreaterThanOrEqual(28)
        expect(dx).toBeLessThanOrEqual(32)
    })

    test('elastic=0 (no overdrag) settles without visible bounce', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@isPlaywright=true')

        const box = page.getByTestId('elastic-0')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        await box.dispatchEvent('pointerdown', {
            clientX: start.x + 10,
            clientY: start.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 10 + 120,
            clientY: start.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + 10 + 120,
            clientY: start.y + 10,
            pointerId: 1
        })

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
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        await box.dispatchEvent('pointerdown', {
            clientX: start.x + 10,
            clientY: start.y + 10,
            pointerId: 11
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 120,
            clientY: start.y + 10,
            pointerId: 11
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + 120,
            clientY: start.y + 10,
            pointerId: 11
        })

        await page.waitForTimeout(400)
        const settled1 = await box.boundingBox()
        if (!settled1) throw new Error('no settled1')

        await box.dispatchEvent('pointerdown', {
            clientX: settled1.x + 10,
            clientY: settled1.y + 10,
            pointerId: 22
        })

        const afterDown = await box.boundingBox()
        if (!afterDown) throw new Error('no afterDown')
        expect(Math.abs(afterDown.x - settled1.x)).toBeLessThan(1.5)

        const LIMIT = 30
        await page.dispatchEvent('body', 'pointermove', {
            clientX: settled1.x + 10 + 200,
            clientY: settled1.y + 10,
            pointerId: 22
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: settled1.x + 10 + 200,
            clientY: settled1.y + 10,
            pointerId: 22
        })

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
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 300,
            clientY: s.y + 10,
            pointerId: 2
        })
        await page.waitForTimeout(200)
        const mid = await el.boundingBox()
        if (!mid) throw new Error('no mid')

        await el.dispatchEvent('pointerdown', {
            clientX: mid.x + 10,
            clientY: mid.y + 10,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: mid.x + 300,
            clientY: mid.y + 10,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: mid.x + 300,
            clientY: mid.y + 10,
            pointerId: 3
        })
        await page.waitForTimeout(200)
        const end = await el.boundingBox()
        if (!end) throw new Error('no end')
        // const dx = Math.round(end.x - mid.x)
        // With pixel constraints anchored to base 0, the element's absolute x will continue to be clamped to +30.
        // The delta from mid may be 0 if both clamps resolve to the same absolute bound. Assert absolute clamp.
        const absClamp = Math.round(end.x - s.x)
        expect(absClamp).toBeGreaterThanOrEqual(28)
        expect(absClamp).toBeLessThanOrEqual(32)
    })
})
