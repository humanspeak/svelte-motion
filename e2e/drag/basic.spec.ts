import { expect, test } from '@playwright/test'

test.describe('drag/basic', () => {
    test('moves when dragged', async ({ page }) => {
        await page.goto('/tests/drag/basic?@humanspeak-svelte-motion-isPlaywright=true')
        const box = page.getByTestId('drag-box')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        await box.dispatchEvent('pointerdown', {
            clientX: start.x + 10,
            clientY: start.y + 10,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 80,
            clientY: start.y + 40,
            pointerId: 1
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + 80,
            clientY: start.y + 40,
            pointerId: 1
        })

        const end = await box.boundingBox()
        if (!end) throw new Error('no end')
        expect(end.x).toBeGreaterThan(start.x + 20)
    })

    test('has momentum after release', async ({ page }) => {
        await page.goto('/tests/drag/basic?@humanspeak-svelte-motion-isPlaywright=true')
        const box = page.getByTestId('drag-box')
        const start = await box.boundingBox()
        if (!start) throw new Error('no start')

        await box.dispatchEvent('pointerdown', {
            clientX: start.x + 10,
            clientY: start.y + 10,
            pointerId: 2
        })
        await page.waitForTimeout(40)
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 60,
            clientY: start.y + 20,
            pointerId: 2
        })
        await page.waitForTimeout(40)
        await page.dispatchEvent('body', 'pointermove', {
            clientX: start.x + 90,
            clientY: start.y + 30,
            pointerId: 2
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: start.x + 90,
            clientY: start.y + 30,
            pointerId: 2
        })

        const baseline = await box.boundingBox()
        if (!baseline) throw new Error('no baseline')

        const samples: number[] = []
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(50)
            const bb = await box.boundingBox()
            if (bb) samples.push(bb.x)
        }
        const maxDelta = Math.max(...samples.map((x) => x - baseline.x))
        expect(maxDelta).toBeGreaterThan(30)
    })

    test('second drag starts from transformed position', async ({ page }) => {
        await page.goto('/tests/drag/basic?@humanspeak-svelte-motion-isPlaywright=true')
        const box = page.getByTestId('drag-box')
        const s = await box.boundingBox()
        if (!s) throw new Error('no s')

        await box.dispatchEvent('pointerdown', {
            clientX: s.x + 10,
            clientY: s.y + 10,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: s.x + 80,
            clientY: s.y + 40,
            pointerId: 3
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: s.x + 80,
            clientY: s.y + 40,
            pointerId: 3
        })

        const mid = await box.boundingBox()
        if (!mid) throw new Error('no mid')

        await box.dispatchEvent('pointerdown', {
            clientX: mid.x + 10,
            clientY: mid.y + 10,
            pointerId: 4
        })
        await page.dispatchEvent('body', 'pointermove', {
            clientX: mid.x + 40,
            clientY: mid.y + 30,
            pointerId: 4
        })
        await page.dispatchEvent('body', 'pointerup', {
            clientX: mid.x + 40,
            clientY: mid.y + 30,
            pointerId: 4
        })
        const end = await box.boundingBox()
        if (!end) throw new Error('no end')
        expect(end.x - mid.x).toBeGreaterThan(10)
    })
})
