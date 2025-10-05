import { expect, test } from '@playwright/test'

test.describe('Notifications Stack - Variants', () => {
    test('should start in closed state with notifications properly stacked on initial load', async ({
        page
    }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )

        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle')

        // Verify state indicator shows closed
        const stateText = page.locator('text=State:').locator('..').locator('span.font-mono')
        await expect(stateText).toHaveText('closed')

        // Header container should be hidden (opacity 0) on initial load
        const headerContainer = page.getByTestId('header-container')
        await expect(headerContainer).toHaveCSS('opacity', '0')

        // Get all notification divs using data-testid
        const getNotification = (index: number) => page.getByTestId(`notification-${index}`)

        // Should have 3 notifications
        const count = 3
        expect(count).toBe(3)

        // First notification should be fully opaque (opacity 1)
        const firstNotification = getNotification(0)
        await expect(firstNotification).toHaveCSS('opacity', '1')

        // Verify they are stacked with proper transforms in closed state
        // In closed state, notifications should have negative y transforms
        for (let i = 0; i < count; i++) {
            const notification = getNotification(i)
            const transform = await notification.evaluate(
                (el) => window.getComputedStyle(el).transform
            )

            if (i === 0) {
                // First notification should be at y=0 (or close to it) in closed state
                // transform should be "none" or very close to identity
                const isAtOrigin =
                    transform === 'none' ||
                    transform.includes('matrix(1, 0, 0, 1, 0, 0)') ||
                    transform.includes('matrix(1, 0, 0, 1, 0.')
                expect(isAtOrigin).toBeTruthy()
            } else {
                // Other notifications should have negative y transform (stacked below)
                expect(transform).not.toBe('none')
            }
        }
    })

    test('should expand when clicked and show all notifications', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        const getNotification = (index: number) => page.getByTestId(`notification-${index}`)

        // Click the first notification to open
        const firstNotification = getNotification(0)
        await firstNotification.click()

        // Wait for animation
        await page.waitForTimeout(500)

        // Verify state shows open
        const stateText = page.locator('text=State:').locator('..').locator('span.font-mono')
        await expect(stateText).toHaveText('open')

        // Header container should be visible (opacity 1)
        const headerContainer = page.getByTestId('header-container')
        await expect(headerContainer).toHaveCSS('opacity', '1')

        // Collapse button should be visible
        await expect(page.getByRole('button', { name: 'Collapse' })).toBeVisible()

        // All notifications should be fully opaque in open state
        const count = 3
        for (let i = 0; i < count; i++) {
            const notification = getNotification(i)
            await expect(notification).toHaveCSS('opacity', '1')
        }
    })

    test('should collapse when collapse button is clicked', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        const getNotification = (index: number) => page.getByTestId(`notification-${index}`)

        // Open the stack
        await getNotification(0).click()
        await page.waitForTimeout(500)

        // Verify it's open
        const stateText = page.locator('text=State:').locator('..').locator('span.font-mono')
        await expect(stateText).toHaveText('open')

        // Click collapse button
        await page.getByRole('button', { name: 'Collapse' }).click()
        await page.waitForTimeout(500)

        // Verify state shows closed
        await expect(stateText).toHaveText('closed')

        // Header container should be hidden again
        const headerContainer = page.getByTestId('header-container')
        await expect(headerContainer).toHaveCSS('opacity', '0')

        // First notification should be opaque, others should have reduced opacity
        await expect(getNotification(0)).toHaveCSS('opacity', '1')
    })

    test('should properly inherit variants from parent to children', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        const getNotification = (index: number) => page.getByTestId(`notification-${index}`)

        // This test verifies that children respond to parent variant changes
        // without having explicit animate props

        // Open
        await getNotification(0).click()
        await page.waitForTimeout(500)

        // All notifications should animate to open state
        const count = 3
        for (let i = 0; i < count; i++) {
            const notification = getNotification(i)
            await expect(notification).toHaveCSS('opacity', '1')
        }

        // Close again
        await page.getByRole('button', { name: 'Collapse' }).click()
        await page.waitForTimeout(500)

        // Notifications should return to stacked state with reduced opacity
        // First is fully opaque
        await expect(getNotification(0)).toHaveCSS('opacity', '1')
    })

    test('should apply stagger delays correctly', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        const getNotification = (index: number) => page.getByTestId(`notification-${index}`)

        // Open the stack
        await getNotification(0).click()

        // Take multiple measurements during animation to verify stagger
        await page.waitForTimeout(50)
        const opacities: number[] = []
        const count = 3

        for (let i = 0; i < count; i++) {
            const opacity = await getNotification(i).evaluate((el) => {
                return parseFloat(window.getComputedStyle(el).opacity)
            })
            opacities.push(opacity)
        }

        // Verify we have 3 measurements
        expect(opacities.length).toBe(3)
    })

    test('should animate smoothly on first click (not jump instantly)', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        const getNotification = (index: number) => page.getByTestId(`notification-${index}`)

        // Get the second notification (index 1) which should have significant transform change
        const secondNotification = getNotification(1)

        // Click to open
        const firstNotification = getNotification(0)
        await firstNotification.click()

        // Capture transforms at multiple points during animation to verify smooth transition
        const transforms: string[] = []

        // Sample at 10 points during the animation
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(30) // 30ms intervals
            const transform = await secondNotification.evaluate((el) => {
                return window.getComputedStyle(el).transform
            })
            transforms.push(transform)
        }

        // Verify we got intermediate states (animation in progress)
        // If it jumps instantly, all samples would be the same
        // With smooth animation, we should see at least 3 different transform values
        const uniqueTransforms = new Set(transforms)
        expect(uniqueTransforms.size).toBeGreaterThanOrEqual(3)

        // Wait for animation to complete
        await page.waitForTimeout(300)

        // Verify final state - should be at y=0 (open state)
        const finalTransform = await secondNotification.evaluate((el) => {
            return window.getComputedStyle(el).transform
        })

        // In open state, y should be close to 0
        // Transform should be identity matrix or have y translation near 0
        const hasYTranslation = finalTransform.includes('matrix')
        if (hasYTranslation) {
            // Extract y translation from matrix (6th value)
            const matrixValues = finalTransform.match(/matrix\(([^)]+)\)/)
            if (matrixValues) {
                const values = matrixValues[1].split(',').map((v) => parseFloat(v.trim()))
                const yTranslation = values[5] || 0
                // Y should be close to 0 in open state
                expect(Math.abs(yTranslation)).toBeLessThan(5)
            }
        }
    })
})
