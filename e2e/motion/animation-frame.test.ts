import { expect, test } from '@playwright/test'

test.describe('useAnimationFrame', () => {
    test('should animate cube with requestAnimationFrame', async ({ page }) => {
        await page.goto('/tests/animation-frame')

        // Wait for the cube element to be present
        const cube = page.locator('.cube')
        await expect(cube).toBeVisible()

        // Get initial transform value
        const initialTransform = await cube.evaluate((el) => el.style.transform)

        // Wait a bit for the animation to progress
        await page.waitForTimeout(100)

        // Get transform after some frames have passed
        const laterTransform = await cube.evaluate((el) => el.style.transform)

        // The transform should have changed (animation is running)
        expect(initialTransform).not.toBe(laterTransform)

        // Verify that transform contains both translateY and rotate values
        await expect(cube).toHaveAttribute('style', /translateY\([^)]+\)/)
        await expect(cube).toHaveAttribute('style', /rotateX\([^)]+\)/)
        await expect(cube).toHaveAttribute('style', /rotateY\([^)]+\)/)

        // Wait another interval and verify it continues to animate
        await page.waitForTimeout(100)
        const finalTransform = await cube.evaluate((el) => el.style.transform)

        // Should have changed again
        expect(laterTransform).not.toBe(finalTransform)

        // Verify cube has 6 sides
        const sides = page.locator('.side')
        await expect(sides).toHaveCount(6)

        // Verify each side has proper class names
        await expect(page.locator('.side.front')).toBeVisible()
        await expect(page.locator('.side.back')).toBeVisible()
        await expect(page.locator('.side.left')).toBeVisible()
        await expect(page.locator('.side.right')).toBeVisible()
        await expect(page.locator('.side.top')).toBeVisible()
        await expect(page.locator('.side.bottom')).toBeVisible()
    })

    test('should have consistent animation over time', async ({ page }) => {
        await page.goto('/tests/animation-frame')

        const cube = page.locator('.cube')
        await expect(cube).toBeVisible()

        // Collect several transform values over time
        const transforms: string[] = []

        for (let i = 0; i < 5; i++) {
            await page.waitForTimeout(50)
            const transform = await cube.evaluate((el) => el.style.transform)
            transforms.push(transform)
        }

        // All transforms should be different (animation is continuous)
        const uniqueTransforms = new Set(transforms)
        expect(uniqueTransforms.size).toBe(transforms.length)

        // Each transform should have the expected pattern
        for (const transform of transforms) {
            expect(transform).toMatch(/translateY\([^)]+px\)/)
            expect(transform).toMatch(/rotateX\([^)]+deg\)/)
            expect(transform).toMatch(/rotateY\([^)]+deg\)/)
        }
    })

    test('should display documentation text', async ({ page }) => {
        await page.goto('/tests/animation-frame')

        // Check for heading
        await expect(page.getByRole('heading', { name: 'useAnimationFrame' })).toBeVisible()

        // Check for descriptive text
        await expect(page.getByText('which runs a callback on every animation frame')).toBeVisible()

        // Check for comparison with useTime
        await expect(page.getByText(/Unlike.*useTime.*which returns a store/)).toBeVisible()
    })
})
