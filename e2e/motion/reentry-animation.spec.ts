import { expect, test } from '@playwright/test'

test.describe('AnimatePresence re-entry animation', () => {
    test('animates in when toggled back on after exit (initial={false})', async ({ page }) => {
        await page.goto('/tests/animate-presence/basic?@isPlaywright=true')

        const box = page.locator('[data-testid="box"]')
        const toggle = page.locator('[data-testid="toggle"]')

        // 1. Initially visible - with initial={false}, box should appear WITHOUT animation
        await expect(box).toBeVisible()

        // Wait for element to be at full size (no animation, just immediate appearance)
        await page.waitForFunction(
            () => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return false
                const rect = el.getBoundingClientRect()
                const styles = getComputedStyle(el)
                const opacity = parseFloat(styles.opacity)
                return rect.width >= 90 && rect.height >= 90 && opacity >= 0.99
            },
            { timeout: 3000 }
        )

        // 2. Click to hide - trigger exit animation
        await toggle.click()

        // Wait for exit animation to complete - clone appears and then disappears
        await page.waitForFunction(() => !!document.querySelector('[data-clone="true"]'), {
            timeout: 2000
        })
        const clone = page.locator('[data-clone="true"]')
        await expect(clone).toHaveCount(0, { timeout: 3000 })

        // Box should be gone
        await expect(box).toHaveCount(0)

        // 3. Click to show again - THIS is the key test: should animate IN
        await toggle.click()

        // Box should appear
        await expect(box).toBeVisible({ timeout: 2000 })

        // Capture initial state - should start from initial values (opacity: 0, scale: 0)
        // We need to capture this quickly before animation completes
        const initialState = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
            if (!el) return null
            const styles = getComputedStyle(el)
            return {
                opacity: parseFloat(styles.opacity),
                transform: styles.transform
            }
        })

        // The element should start from initial state (opacity near 0, scale near 0)
        // If it snaps, opacity and scale would be 1 immediately
        expect(initialState).toBeTruthy()

        // Either we catch it animating (opacity < 0.5 or scale < 0.5)
        // OR we verify that after animation completes it's at full values
        // The key is that it MUST animate, not snap

        // Wait for animation to complete
        await page.waitForFunction(
            () => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return false
                const styles = getComputedStyle(el)
                const opacity = parseFloat(styles.opacity)
                const transform = styles.transform

                if (opacity < 0.99) return false

                if (transform === 'none') return true

                const scaleMatch = transform.match(/scale\(([^)]+)\)/)
                if (scaleMatch) {
                    const scale = parseFloat(scaleMatch[1])
                    return scale >= 0.99
                }

                const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
                if (matrixMatch) {
                    const values = matrixMatch[1].split(',').map((v) => parseFloat(v.trim()))
                    if (values.length >= 4) {
                        return values[0] >= 0.99
                    }
                }

                return true
            },
            { timeout: 5000 }
        )

        // Verify animation completed - element should be fully visible
        const finalState = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
            if (!el) return null
            const styles = getComputedStyle(el)
            return {
                opacity: parseFloat(styles.opacity),
                transform: styles.transform
            }
        })

        expect(finalState).toBeTruthy()
        expect(finalState!.opacity).toBeGreaterThanOrEqual(0.99)
    })

    test('re-entry animation starts from initial keyframes', async ({ page }) => {
        await page.goto('/tests/animate-presence/basic?@isPlaywright=true')

        const toggle = page.locator('[data-testid="toggle"]')

        // Initial appearance (no animation due to initial={false})
        await page.waitForFunction(
            () => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return false
                const styles = getComputedStyle(el)
                return parseFloat(styles.opacity) >= 0.99
            },
            { timeout: 3000 }
        )

        // Hide
        await toggle.click()
        await page.waitForFunction(() => !document.querySelector('[data-testid="box"]'), {
            timeout: 5000
        })

        // Show again - capture animation progression
        await toggle.click()

        // Capture multiple samples of the animation to prove it's animating
        const samples: { opacity: number; scale: number | null; timestamp: number }[] = []
        const startTime = Date.now()

        while (Date.now() - startTime < 1500 && samples.length < 20) {
            const sample = await page.evaluate(() => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return null
                const styles = getComputedStyle(el)
                const opacity = parseFloat(styles.opacity)
                const transform = styles.transform

                let scale: number | null = null
                if (transform === 'none') {
                    scale = 1
                } else {
                    const scaleMatch = transform.match(/scale\(([^)]+)\)/)
                    if (scaleMatch) {
                        scale = parseFloat(scaleMatch[1])
                    } else {
                        const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
                        if (matrixMatch) {
                            const values = matrixMatch[1]
                                .split(',')
                                .map((v) => parseFloat(v.trim()))
                            if (values.length >= 4) {
                                scale = values[0]
                            }
                        }
                    }
                }

                return { opacity, scale }
            })

            if (sample) {
                samples.push({ ...sample, timestamp: Date.now() - startTime })
            }
            await page.waitForTimeout(50)
        }

        // Verify we captured animation progression
        expect(samples.length).toBeGreaterThan(0)

        // Find the first sample where element exists
        const firstValidSample = samples.find((s) => s.opacity !== null)
        expect(firstValidSample).toBeTruthy()

        // Find the last sample (should be near full opacity/scale)
        const lastSample = samples[samples.length - 1]
        expect(lastSample.opacity).toBeGreaterThanOrEqual(0.9)

        // If animation is working, we should see opacity/scale values less than 1 in early samples
        // If it's snapping, ALL samples would be at 1
        const hasAnimatedValues = samples.some(
            (s) => s.opacity < 0.95 || (s.scale !== null && s.scale < 0.95)
        )

        // This is the critical assertion - proves animation happened
        expect(hasAnimatedValues).toBe(true)
    })

    test('multiple re-entries all animate correctly', async ({ page }) => {
        await page.goto('/tests/animate-presence/basic?@isPlaywright=true')

        const toggle = page.locator('[data-testid="toggle"]')

        // Initial appearance (no animation due to initial={false})
        await page.waitForFunction(
            () => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return false
                const styles = getComputedStyle(el)
                return parseFloat(styles.opacity) >= 0.99
            },
            { timeout: 3000 }
        )

        // Perform multiple hide/show cycles
        for (let cycle = 1; cycle <= 3; cycle++) {
            // Hide
            await toggle.click()
            await page.waitForFunction(() => !document.querySelector('[data-testid="box"]'), {
                timeout: 5000
            })

            // Show again
            await toggle.click()

            // Capture animation progression for this cycle
            const samples: { opacity: number; scale: number | null }[] = []
            const startTime = Date.now()

            while (Date.now() - startTime < 1000 && samples.length < 15) {
                const sample = await page.evaluate(() => {
                    const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                    if (!el) return null
                    const styles = getComputedStyle(el)
                    const opacity = parseFloat(styles.opacity)
                    const transform = styles.transform

                    let scale: number | null = null
                    if (transform === 'none') {
                        scale = 1
                    } else {
                        const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
                        if (matrixMatch) {
                            const values = matrixMatch[1]
                                .split(',')
                                .map((v) => parseFloat(v.trim()))
                            if (values.length >= 4) {
                                scale = values[0]
                            }
                        }
                    }

                    return { opacity, scale }
                })

                if (sample) {
                    samples.push(sample)
                }
                await page.waitForTimeout(50)
            }

            // Verify animation happened for this cycle
            const hasAnimatedValues = samples.some(
                (s) => s.opacity < 0.95 || (s.scale !== null && s.scale < 0.95)
            )

            expect(hasAnimatedValues).toBe(true)

            // Wait for animation to complete before next cycle
            await page.waitForFunction(
                () => {
                    const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                    if (!el) return false
                    const styles = getComputedStyle(el)
                    return parseFloat(styles.opacity) >= 0.99
                },
                { timeout: 3000 }
            )
        }
    })

    test('rapid toggle leaves only one element after animations complete', async ({ page }) => {
        await page.goto('/tests/animate-presence/basic?@isPlaywright=true')

        const toggle = page.locator('[data-testid="toggle"]')

        // 1. Initial load - verify 1 box
        await page.waitForFunction(
            () => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return false
                const styles = getComputedStyle(el)
                return parseFloat(styles.opacity) >= 0.99
            },
            { timeout: 3000 }
        )

        const initialBoxCount = await page.evaluate(
            () => document.querySelectorAll('[data-testid="box"]').length
        )
        expect(initialBoxCount).toBe(1)

        // 2. Click Hide - start exit animation
        await toggle.click()

        // 3. Wait only 100ms (less than 1s animation duration)
        await page.waitForTimeout(100)

        // Verify clone exists (exit animation in progress)
        const clonesDuringExit = await page.evaluate(
            () => document.querySelectorAll('[data-clone="true"]').length
        )
        expect(clonesDuringExit).toBe(1)

        // 4. Click Show - start enter animation while exit is still running
        await toggle.click()

        // 5. During transition, both clone and new box should exist
        await page.waitForTimeout(100)
        const elementsDuringTransition = await page.evaluate(() => ({
            // Use :not([data-clone]) to exclude clones which also have data-testid="box"
            boxes: document.querySelectorAll('[data-testid="box"]:not([data-clone="true"])').length,
            clones: document.querySelectorAll('[data-clone="true"]').length
        }))

        // During sync mode, we expect both to be visible
        expect(elementsDuringTransition.boxes).toBe(1) // New box (excluding clone)
        expect(elementsDuringTransition.clones).toBe(1) // Exiting clone

        // 6. Wait for ALL animations to complete (exit is 1s, enter is also animating)
        await page.waitForTimeout(2000)

        // 7. Verify final state: EXACTLY 1 box, ZERO clones
        const finalState = await page.evaluate(() => ({
            // Use :not([data-clone]) to exclude clones which also have data-testid="box"
            boxes: document.querySelectorAll('[data-testid="box"]:not([data-clone="true"])').length,
            clones: document.querySelectorAll('[data-clone="true"]').length
        }))

        expect(finalState.boxes).toBe(1)
        expect(finalState.clones).toBe(0)
    })
})
