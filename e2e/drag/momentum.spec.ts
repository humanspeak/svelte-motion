import { expect, test } from '@playwright/test'

test.describe('drag/momentum', () => {
    test('continues moving after release', async ({ page }) => {
        await page.goto('/tests/drag/momentum?@humanspeak-svelte-motion-isPlaywright=true')
        const el = page.getByTestId('drag-momentum')
        const s = await el.boundingBox()
        if (!s) throw new Error('no s')
        await el.dispatchEvent('pointerdown', { clientX: s.x + 10, clientY: s.y + 10, pointerId: 1 })
        await page.dispatchEvent('body', 'pointermove', { clientX: s.x + 60, clientY: s.y + 10, pointerId: 1 })
        await page.dispatchEvent('body', 'pointermove', { clientX: s.x + 120, clientY: s.y + 10, pointerId: 1 })
        await page.dispatchEvent('body', 'pointerup', { clientX: s.x + 120, clientY: s.y + 10, pointerId: 1 })
        const baseline = await el.boundingBox()
        if (!baseline) throw new Error('no baseline')
        const samples: number[] = []
        for (let i = 0; i < 12; i++) {
            await page.waitForTimeout(50)
            const bb = await el.boundingBox()
            if (bb) samples.push(bb.x)
        }
        const maxDelta = Math.max(...samples.map((x) => x - baseline.x))
        expect(maxDelta).toBeGreaterThan(40)
    })
})


