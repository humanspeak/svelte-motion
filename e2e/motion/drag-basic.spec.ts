import { expect, test } from '@playwright/test'

test.describe('drag/basic', () => {
    test('has momentum after release', async ({ page }) => {
        await page.goto('/tests/drag/basic?@humanspeak-svelte-motion-isPlaywright=true')
        const box = page.getByTestId('drag-box')
        const start = await box.boundingBox()
        if (!start) throw new Error('no box')

        // Simulate human-like drag with multiple moves over time
        await box.dispatchEvent('pointerdown', {
            clientX: start.x + 10,
            clientY: start.y + 10,
            pointerId: 1
        })

        // Drag in steps with delays
        await page.waitForTimeout(50)
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 30,
            clientY: start.y + 15,
            pointerId: 1
        })
        await page.waitForTimeout(50)
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 50,
            clientY: start.y + 20,
            pointerId: 1
        })
        await page.waitForTimeout(50)
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 70,
            clientY: start.y + 25,
            pointerId: 1
        })
        await page.waitForTimeout(50)
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 90,
            clientY: start.y + 30,
            pointerId: 1
        })

        // Wait to stabilize, then capture exact position before release
        await page.waitForTimeout(100)
        const justBeforeRelease = await box.boundingBox()
        if (!justBeforeRelease) throw new Error('no justBeforeRelease')

        // Release pointer
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + 90,
            clientY: start.y + 30,
            pointerId: 1
        })

        // Wait one RAF for release to process
        await page.waitForTimeout(20)

        // Baseline: position right after release event processed
        const baseline = await box.boundingBox()
        if (!baseline) throw new Error('no baseline')

        // Poll for momentum movement over 1 second
        const samples: number[] = []
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(50)
            const bb = await box.boundingBox()
            if (bb) samples.push(bb.x)
        }

        // Measure ONLY post-release movement
        const postReleaseDelta = samples.map((x) => x - baseline.x)
        const maxPostRelease = Math.max(...postReleaseDelta)

        console.log('Baseline X (at release):', baseline.x.toFixed(2))
        console.log('Post-release deltas:', postReleaseDelta.map((m) => m.toFixed(1)).join(', '))
        console.log('Max post-release movement:', maxPostRelease.toFixed(2))

        // STRICT: Must move at least 30px AFTER release due to momentum
        expect(maxPostRelease).toBeGreaterThan(30)
    })

    test('second drag starts from correct transformed position', async ({ page }) => {
        await page.goto('/tests/drag/basic?@humanspeak-svelte-motion-isPlaywright=true')
        const box = page.getByTestId('drag-box')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        // First drag
        await box.dispatchEvent('pointerdown', {
            clientX: start.x + 10,
            clientY: start.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 80,
            clientY: start.y + 60,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + 80,
            clientY: start.y + 60,
            pointerId: 1
        })
        const afterFirst = await box.boundingBox()
        if (!afterFirst) throw new Error('no afterFirst')
        expect(afterFirst.x - start.x).toBeGreaterThan(20)

        // Second drag should respect new origin
        await box.dispatchEvent('pointerdown', {
            clientX: afterFirst.x + 10,
            clientY: afterFirst.y + 10,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: afterFirst.x + 40,
            clientY: afterFirst.y + 30,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: afterFirst.x + 40,
            clientY: afterFirst.y + 30,
            pointerId: 2
        })
        const afterSecond = await box.boundingBox()
        if (!afterSecond) throw new Error('no afterSecond')
        expect(afterSecond.x - afterFirst.x).toBeGreaterThan(10)
    })
})
