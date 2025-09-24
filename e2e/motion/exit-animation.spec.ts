import { expect, test } from '@playwright/test'

function parseScale(transform: string): number | null {
    const m = transform.match(/matrix\(([^)]+)\)/)
    if (!m) return transform === 'none' ? 1 : null
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
    if (parts.length < 4 || Number.isNaN(parts[0]) || Number.isNaN(parts[3])) return null
    return parts[0]
}

test.describe('AnimatePresence exit animation', () => {
    test('animates out when toggled off with preserved shape', async ({ page }) => {
        await page.goto(
            '/tests/motion/animate-presence?@humanspeak-svelte-motion-isPlaywright=true'
        )

        const box = page.locator('[data-testid="box"]')
        const toggle = page.locator('[data-testid="toggle"]')

        await expect(box).toBeVisible()

        // Wait for full size ~96px
        await page.waitForFunction(
            () => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return false
                const r = el.getBoundingClientRect()
                return r.width >= 90 && r.height >= 90
            },
            { timeout: 3000 }
        )

        const boxRect = await box.evaluate((el) => el.getBoundingClientRect())
        const boxStyles = await box.evaluate((el) => {
            const cs = getComputedStyle(el as HTMLElement)
            return {
                borderRadius: cs.borderRadius,
                clipPath: cs.clipPath,
                boxShadow: cs.boxShadow,
                transform: cs.transform
            }
        })

        await toggle.click()

        await expect(box).toHaveCount(0, { timeout: 1000 })

        await page.waitForFunction(() => !!document.querySelector('[data-clone="true"]'), {
            timeout: 2000
        })
        const clone = page.locator('[data-clone="true"]')
        await expect(clone).toBeVisible({ timeout: 1500 })

        const cloneRect = await clone.evaluate((el) => el.getBoundingClientRect())
        expect(Math.abs(cloneRect.width - boxRect.width)).toBeLessThanOrEqual(2)
        expect(Math.abs(cloneRect.height - boxRect.height)).toBeLessThanOrEqual(2)

        const cloneStyles = await clone.evaluate((el) => {
            const cs = getComputedStyle(el as HTMLElement)
            return {
                borderRadius: cs.borderRadius,
                clipPath: cs.clipPath,
                boxShadow: cs.boxShadow,
                transform: cs.transform,
                opacity: cs.opacity
            }
        })
        expect(cloneStyles.borderRadius).toBe(boxStyles.borderRadius)
        expect(cloneStyles.clipPath).toBe(boxStyles.clipPath)
        expect(typeof cloneStyles.boxShadow).toBe('string')

        const start = Date.now()
        let sawOpacityDrop = false
        let sawScaleDrop = false
        while (Date.now() - start < 2000 && !(sawOpacityDrop || sawScaleDrop)) {
            try {
                const { opacity, transform } = await clone.evaluate((el) => {
                    const cs = getComputedStyle(el as HTMLElement)
                    return { opacity: cs.opacity, transform: cs.transform }
                })
                const op = parseFloat(opacity)
                const scale = parseScale(transform)
                if (!Number.isNaN(op) && op < 1) sawOpacityDrop = true
                if (scale !== null && scale < 1) sawScaleDrop = true
            } catch {
                break
            }
            await page.waitForTimeout(50)
        }
        expect(sawOpacityDrop || sawScaleDrop).toBeTruthy()

        await expect(clone).toHaveCount(0, { timeout: 3000 })
    })
})
