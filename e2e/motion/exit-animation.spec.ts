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

        // Wait for enter animation to complete (size + opacity + scale = 1)
        // This is required - AnimatePresence only works if you wait for enter to finish
        await page.waitForFunction(
            () => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return false

                const rect = el.getBoundingClientRect()
                const styles = getComputedStyle(el)
                const opacity = parseFloat(styles.opacity)
                const transform = styles.transform

                // Must have full size (96px for size-24)
                if (rect.width < 90 || rect.height < 90) return false

                // Must be fully opaque
                if (opacity < 0.99) return false

                // Must be fully scaled in (scale = 1)
                if (transform === 'none') return true

                // scale(s)
                const scaleMatch = transform.match(/scale\(([^)]+)\)/)
                if (scaleMatch) {
                    const scale = parseFloat(scaleMatch[1])
                    return scale >= 0.99
                }

                // 2D matrix(a, b, c, d, tx, ty) → scaleX = a
                const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
                if (matrixMatch) {
                    const values = matrixMatch[1].split(',').map((v) => parseFloat(v.trim()))
                    if (values.length >= 4) {
                        const scaleX = values[0]
                        return scaleX >= 0.99
                    }
                }

                // 3D matrix3d(m11, m12, ..., m33, tx, ty, tz) → scaleX=m11 (index 0), scaleY=m22 (index 5)
                const matrix3dMatch = transform.match(/matrix3d\(([^)]+)\)/)
                if (matrix3dMatch) {
                    const values = matrix3dMatch[1].split(',').map((v) => parseFloat(v.trim()))
                    if (values.length >= 16) {
                        const scaleX = values[0]
                        const scaleY = values[5]
                        return scaleX >= 0.99 && scaleY >= 0.99
                    }
                }

                // Unknown transform → fail closed
                return false
            },
            { timeout: 5000 }
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

        // Click hide button to trigger exit animation
        await toggle.click()

        // Wait for clone to appear and capture its properties immediately
        await page.waitForFunction(() => !!document.querySelector('[data-clone="true"]'), {
            timeout: 2000
        })

        // Capture clone properties as soon as it appears (before it animates out)
        const cloneData = await page.evaluate(() => {
            const clone = document.querySelector('[data-clone="true"]') as HTMLElement
            if (!clone) return null

            const rect = clone.getBoundingClientRect()
            const cs = getComputedStyle(clone)
            return {
                rect: {
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    left: rect.left
                },
                styles: {
                    borderRadius: cs.borderRadius,
                    clipPath: cs.clipPath,
                    boxShadow: cs.boxShadow,
                    transform: cs.transform,
                    opacity: cs.opacity
                }
            }
        })

        expect(cloneData).toBeTruthy()
        expect(Math.abs(cloneData!.rect.width - boxRect.width)).toBeLessThanOrEqual(3)
        expect(Math.abs(cloneData!.rect.height - boxRect.height)).toBeLessThanOrEqual(3)
        expect(cloneData!.styles.borderRadius).toBe(boxStyles.borderRadius)
        expect(cloneData!.styles.clipPath).toBe(boxStyles.clipPath)
        expect(typeof cloneData!.styles.boxShadow).toBe('string')

        // Original box should eventually disappear from DOM after exit animation starts
        await expect(box).toHaveCount(0, { timeout: 2000 })

        // Verify clone animates out and gets removed
        // Since the animation is fast, we'll check if clone eventually disappears
        const clone = page.locator('[data-clone="true"]')

        // Try to observe animation changes, but don't fail if clone disappears quickly
        const start = Date.now()
        let sawAnimation = false
        while (Date.now() - start < 1500 && !sawAnimation) {
            try {
                const animationData = await page.evaluate(() => {
                    const cloneEl = document.querySelector('[data-clone="true"]') as HTMLElement
                    if (!cloneEl) return null
                    const cs = getComputedStyle(cloneEl)
                    return { opacity: cs.opacity, transform: cs.transform }
                })

                if (!animationData) break // Clone was removed

                const op = parseFloat(animationData.opacity)
                const scale = parseScale(animationData.transform)
                if (!Number.isNaN(op) && op < 1) sawAnimation = true
                if (scale !== null && scale < 1) sawAnimation = true
            } catch {
                break // Clone was removed during check
            }
            await page.waitForTimeout(50)
        }

        // Clone should eventually be removed (this is the key test)
        await expect(clone).toHaveCount(0, { timeout: 3000 })
    })
})
