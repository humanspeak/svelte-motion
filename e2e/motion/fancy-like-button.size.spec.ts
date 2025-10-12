import { expect, test } from '@playwright/test'

test.describe('Fancy Like Button - size stability', () => {
    test('does not shrink after press animation completes', async ({ page }) => {
        await page.goto(
            '/tests/random/fancy-like-button?@humanspeak-svelte-motion-isPlaywright=true'
        )

        const btn = page.getByTestId('fancy-like-button')
        await expect(btn).toBeVisible()

        const getSize = async () => {
            const bb = await btn.boundingBox()
            if (!bb) throw new Error('no bounding box')
            return { w: bb.width, h: bb.height }
        }

        const before = await getSize()
        console.log('[like] before size', before)

        // Press (pointerdown) then release (pointerup)
        const bb = await btn.boundingBox()
        if (!bb) throw new Error('no bb for click')
        await btn.dispatchEvent('pointerdown', {
            clientX: bb.x + bb.width / 2,
            clientY: bb.y + bb.height / 2,
            pointerId: 1
        })
        await page.waitForTimeout(60)
        await page.dispatchEvent('body', 'pointerup', {
            clientX: bb.x + bb.width / 2,
            clientY: bb.y + bb.height / 2,
            pointerId: 1
        })

        // Wait for animation to complete: poll until size stabilizes over 3 samples
        let stable = 0
        let last: { w: number; h: number } | null = null
        for (let i = 0; i < 40 && stable < 3; i++) {
            await page.waitForTimeout(50)
            const s = await getSize()
            if (last && Math.abs(s.w - last.w) < 0.2 && Math.abs(s.h - last.h) < 0.2) {
                stable++
            } else {
                stable = 0
            }
            last = s
        }

        const after = await getSize()
        console.log('[like] after size', after)

        // Allow minor subpixel differences but assert it didn't shrink by >1px in either dimension
        expect(after.w + 1).toBeGreaterThanOrEqual(before.w)
        expect(after.h + 1).toBeGreaterThanOrEqual(before.h)
    })
})
