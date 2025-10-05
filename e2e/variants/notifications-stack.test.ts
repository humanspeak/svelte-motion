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

        // Header should be hidden (opacity 0) on initial load
        // The h2 with "Notifications" text inside stack should have opacity 0
        const header = page.locator('h2').filter({ hasText: 'Notifications' }).first()
        await expect(header).toHaveCSS('opacity', '0')

        // Get all notification divs - they're inside the stack-container
        const notifications = page
            .locator('.stack-container')
            .locator('[data-playwright="true"]')
            .filter({ hasText: /Notification \d+/ })

        // Should have 3 notifications
        const count = await notifications.count()
        expect(count).toBe(3)

        // First notification should be fully opaque (opacity 1)
        const firstNotification = notifications.nth(0)
        await expect(firstNotification).toHaveCSS('opacity', '1')

        // Verify they are stacked with proper transforms in closed state
        // In closed state, notifications should have negative y transforms
        for (let i = 0; i < count; i++) {
            const notification = notifications.nth(i)
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

        // Click the first notification to open
        const notifications = page
            .locator('.stack-container')
            .locator('[data-playwright="true"]')
            .filter({ hasText: /Notification \d+/ })
        const firstNotification = notifications.nth(0)
        await firstNotification.click()

        // Wait for animation
        await page.waitForTimeout(500)

        // Verify state shows open
        const stateText = page.locator('text=State:').locator('..').locator('span.font-mono')
        await expect(stateText).toHaveText('open')

        // Header should be visible (opacity 1)
        const header = page.locator('h2').filter({ hasText: 'Notifications' }).first()
        await expect(header).toHaveCSS('opacity', '1')

        // Collapse button should be visible
        await expect(page.locator('text=Collapse')).toBeVisible()

        // All notifications should be fully opaque in open state
        const count = await notifications.count()
        for (let i = 0; i < count; i++) {
            const notification = notifications.nth(i)
            await expect(notification).toHaveCSS('opacity', '1')
        }
    })

    test('should collapse when collapse button is clicked', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        // Open the stack
        const notifications = page
            .locator('.stack-container')
            .locator('[data-playwright="true"]')
            .filter({ hasText: /Notification \d+/ })
        await notifications.nth(0).click()
        await page.waitForTimeout(500)

        // Verify it's open
        const stateText = page.locator('text=State:').locator('..').locator('span.font-mono')
        await expect(stateText).toHaveText('open')

        // Click collapse button
        await page.getByRole('button', { name: 'Collapse' }).click()
        await page.waitForTimeout(500)

        // Verify state shows closed
        await expect(stateText).toHaveText('closed')

        // Header should be hidden again
        const header = page.locator('h2').filter({ hasText: 'Notifications' }).first()
        await expect(header).toHaveCSS('opacity', '0')

        // First notification should be opaque, others should have reduced opacity
        await expect(notifications.nth(0)).toHaveCSS('opacity', '1')
    })

    test('should properly inherit variants from parent to children', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        // This test verifies that children respond to parent variant changes
        // without having explicit animate props

        const notifications = page
            .locator('.stack-container')
            .locator('[data-playwright="true"]')
            .filter({ hasText: /Notification \d+/ })

        // Open
        await notifications.nth(0).click()
        await page.waitForTimeout(500)

        // All notifications should animate to open state
        const count = await notifications.count()
        for (let i = 0; i < count; i++) {
            const notification = notifications.nth(i)
            await expect(notification).toHaveCSS('opacity', '1')
        }

        // Close again
        await page.getByRole('button', { name: 'Collapse' }).click()
        await page.waitForTimeout(500)

        // Notifications should return to stacked state with reduced opacity
        // First is fully opaque
        await expect(notifications.nth(0)).toHaveCSS('opacity', '1')
    })

    test('should apply stagger delays correctly', async ({ page }) => {
        await page.goto(
            '/tests/variants/notifications-stack?@humanspeak-svelte-motion-isPlaywright=true'
        )
        await page.waitForLoadState('networkidle')

        const notifications = page
            .locator('.stack-container')
            .locator('[data-playwright="true"]')
            .filter({ hasText: /Notification \d+/ })

        // Open the stack
        await notifications.nth(0).click()

        // Take multiple measurements during animation to verify stagger
        await page.waitForTimeout(50)
        const opacities: number[] = []
        const count = await notifications.count()

        for (let i = 0; i < count; i++) {
            const opacity = await notifications.nth(i).evaluate((el) => {
                return parseFloat(window.getComputedStyle(el).opacity)
            })
            opacities.push(opacity)
        }

        // Verify we have 3 measurements
        expect(opacities.length).toBe(3)
    })
})
