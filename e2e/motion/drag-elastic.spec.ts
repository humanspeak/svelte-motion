import { expect, test } from '@playwright/test'

test.describe('drag/elastic', () => {
    test('elastic=0 (no overdrag) settles without visible bounce', async ({ page }) => {
        await page.goto('/tests/drag/elastic?@humanspeak-svelte-motion-isPlaywright=true')

        const box = page.getByTestId('elastic-0')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // Drag to the right past the +30 bound
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

        // Wait and sample; with heavy overdamp there should be minimal oscillation beyond the bound
        const samples: number[] = []
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(60)
            const bb = await box.boundingBox()
            if (bb) samples.push(bb.x)
        }

        // Compute differences between samples (absolute)
        const diffs = samples.slice(1).map((x, i) => Math.abs(x - samples[i]))
        const maxDelta = Math.max(0, ...diffs)
        // We expect near-monotonic approach and very small oscillation with overdamp
        expect(maxDelta).toBeLessThan(2)
    })
    test('second drag respects click point after elastic settle and clamps within bounds', async ({
        page
    }) => {
        await page.goto('/tests/drag/elastic?@humanspeak-svelte-motion-isPlaywright=true')

        const box = page.getByTestId('elastic-05')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // First drag to the right beyond constraints
        await box.dispatchEvent('pointerdown', {
            clientX: start.x + 10,
            clientY: start.y + 10,
            pointerId: 11
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 120, // push past constraint
            clientY: start.y + 10,
            pointerId: 11
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + 120,
            clientY: start.y + 10,
            pointerId: 11
        })

        // Wait for post-release settle (no momentum on this page)
        await page.waitForTimeout(400)
        const settled1 = await box.boundingBox()
        if (!settled1) throw new Error('no settled1')

        // Second drag: click near the left edge of current position
        await box.dispatchEvent('pointerdown', {
            clientX: settled1.x + 10,
            clientY: settled1.y + 10,
            pointerId: 22
        })

        // Immediately after pointerdown, there should be no jump
        const afterDown = await box.boundingBox()
        if (!afterDown) throw new Error('no afterDown')
        expect(Math.abs(afterDown.x - settled1.x)).toBeLessThan(1.5)

        // Move far beyond the right bound; after release it should settle within +30
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

        // Wait for settle: poll until position changes less than 0.5px over 3 samples
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
        const finalDx = finalBB.x - settled1.x
        expect(finalDx).toBeGreaterThanOrEqual(LIMIT - 2)
        expect(finalDx).toBeLessThanOrEqual(LIMIT + 2)

        await page.dispatchEvent('body', 'pointerup', {
            clientX: settled1.x + 10 + 200,
            clientY: settled1.y + 10,
            pointerId: 22
        })
    })
})
