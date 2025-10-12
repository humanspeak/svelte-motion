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

    test('rapid taps do not exceed baseline transform', async ({ page }) => {
        await page.goto(
            '/tests/random/fancy-like-button?@humanspeak-svelte-motion-isPlaywright=true'
        )

        const btn = page.getByTestId('fancy-like-button')
        await expect(btn).toBeVisible()

        const getTransformA = async () => {
            const t = await btn.evaluate((el) => getComputedStyle(el as HTMLElement).transform)
            if (!t || t === 'none') return 1
            const m = t.match(/matrix\(([^)]+)\)/)
            if (!m) return 1
            const [a] = m[1].split(',').map((s) => parseFloat(s.trim()))
            return Number.isFinite(a) ? a : 1
        }

        const baselineA = await getTransformA()

        const bb = await btn.boundingBox()
        if (!bb) throw new Error('no bb')
        const cx = bb.x + bb.width / 2
        const cy = bb.y + bb.height / 2

        for (let i = 0; i < 8; i++) {
            await btn.dispatchEvent('pointerdown', { clientX: cx, clientY: cy, pointerId: 1 })
            await page.dispatchEvent('body', 'pointerup', {
                clientX: cx,
                clientY: cy,
                pointerId: 1
            })
            // Wait a micro tick for sync restore
            await page.waitForTimeout(10)
            const a = await getTransformA()
            // Allow tiny tolerance for float math
            expect(a).toBeLessThanOrEqual(baselineA + 0.01)
        }
    })

    test('rapid taps during reset do not escalate transform', async ({ page }) => {
        await page.goto(
            '/tests/random/fancy-like-button?@humanspeak-svelte-motion-isPlaywright=true'
        )

        const btn = page.getByTestId('fancy-like-button')
        await expect(btn).toBeVisible()

        const getA = async () => {
            const t = await btn.evaluate((el) => getComputedStyle(el as HTMLElement).transform)
            if (!t || t === 'none') return 1
            const m = t.match(/matrix\(([^)]+)\)/)
            if (!m) return 1
            const [a] = m[1].split(',').map((s) => parseFloat(s.trim()))
            return Number.isFinite(a) ? a : 1
        }

        const baselineA = await getA()

        const bb = await btn.boundingBox()
        if (!bb) throw new Error('no bb')
        const cx = bb.x + bb.width / 2
        const cy = bb.y + bb.height / 2

        // Press and release to trigger reset, then interleave taps while reset likely in-flight
        // Simulate the escalation pattern from the provided console logs by interleaving taps
        for (let i = 0; i < 12; i++) {
            await btn.dispatchEvent('pointerdown', { clientX: cx, clientY: cy, pointerId: 1 })
            await page.waitForTimeout(50)
            await page.dispatchEvent('body', 'pointerup', {
                clientX: cx,
                clientY: cy,
                pointerId: 1
            })
            // Immediately start another press during reset window
            await page.waitForTimeout(10)
            await btn.dispatchEvent('pointerdown', { clientX: cx, clientY: cy, pointerId: 1 })
            await page.waitForTimeout(30)
            await page.dispatchEvent('body', 'pointerup', {
                clientX: cx,
                clientY: cy,
                pointerId: 1
            })
            // Let synchronous restore apply
            await page.waitForTimeout(10)
            const a = await getA()
            expect(a).toBeLessThanOrEqual(baselineA + 0.01)
        }
    })
})
