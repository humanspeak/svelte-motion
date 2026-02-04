import { expect, test } from '@playwright/test'

test.describe('Reactive Style (styleString)', () => {
    test('demo box should be visible with initial styles', async ({ page }) => {
        await page.goto('/tests/reactive-style')

        const demoBox = page.getByTestId('demo-box')
        await expect(demoBox).toBeVisible()

        // Check initial data attributes
        await expect(demoBox).toHaveAttribute('data-rotation', '0')
        await expect(demoBox).toHaveAttribute('data-scale', '1')
        await expect(demoBox).toHaveAttribute('data-opacity', '1')
        await expect(demoBox).toHaveAttribute('data-hue', '200')
    })

    test('scale slider should update box scale reactively', async ({ page }) => {
        await page.goto('/tests/reactive-style')

        const demoBox = page.getByTestId('demo-box')
        const scaleSlider = page.getByTestId('scale-slider')

        // Initial scale should be 1
        await expect(demoBox).toHaveAttribute('data-scale', '1')

        // Change scale to 1.5
        await scaleSlider.fill('1.5')

        // Verify scale updated
        await expect(demoBox).toHaveAttribute('data-scale', '1.5')

        // Verify CSS transform includes scale
        const style = await demoBox.getAttribute('style')
        expect(style).toContain('scale')
    })

    test('opacity slider should update box opacity reactively', async ({ page }) => {
        await page.goto('/tests/reactive-style')

        const demoBox = page.getByTestId('demo-box')
        const opacitySlider = page.getByTestId('opacity-slider')

        // Initial opacity should be 1
        await expect(demoBox).toHaveAttribute('data-opacity', '1')

        // Change opacity to 0.5
        await opacitySlider.fill('0.5')

        // Verify opacity updated
        await expect(demoBox).toHaveAttribute('data-opacity', '0.5')

        // Verify CSS opacity is applied
        await expect(demoBox).toHaveCSS('opacity', '0.5')
    })

    test('hue slider should update box background color reactively', async ({ page }) => {
        await page.goto('/tests/reactive-style')

        const demoBox = page.getByTestId('demo-box')
        const hueSlider = page.getByTestId('hue-slider')

        // Initial hue should be 200
        await expect(demoBox).toHaveAttribute('data-hue', '200')

        // Change hue to 50 (yellowish)
        await hueSlider.fill('50')

        // Verify hue updated
        await expect(demoBox).toHaveAttribute('data-hue', '50')
    })

    test('rotation slider should update box rotation when auto mode is off', async ({ page }) => {
        await page.goto('/tests/reactive-style')

        const demoBox = page.getByTestId('demo-box')
        const rotationSlider = page.getByTestId('rotation-slider')

        // Initial rotation should be 0
        await expect(demoBox).toHaveAttribute('data-rotation', '0')

        // Change rotation to 45
        await rotationSlider.fill('45')

        // Verify rotation updated
        await expect(demoBox).toHaveAttribute('data-rotation', '45')

        // Verify CSS rotate is applied
        const style = await demoBox.getAttribute('style')
        expect(style).toContain('rotate')
        expect(style).toContain('45deg')
    })

    test('auto rotate toggle should enable time-based rotation', async ({ page }) => {
        await page.goto('/tests/reactive-style')

        const demoBox = page.getByTestId('demo-box')
        const autoToggle = page.getByTestId('auto-rotate-toggle')
        const rotationSlider = page.getByTestId('rotation-slider')

        // Enable auto rotate
        await autoToggle.check()

        // Rotation slider should be disabled
        await expect(rotationSlider).toBeDisabled()

        // Wait for auto rotation to progress from 0 using polling
        await expect
            .poll(async () => {
                const rotation = await demoBox.getAttribute('data-rotation')
                return parseFloat(rotation || '0')
            })
            .toBeGreaterThan(0)
    })

    test('styleString should correctly handle unit conversion', async ({ page }) => {
        await page.goto('/tests/reactive-style')

        const demoBox = page.getByTestId('demo-box')
        const style = await demoBox.getAttribute('style')

        // Check that numeric dimensions get px units (using regex for resilience)
        expect(style).toMatch(/width:\s*\d+px/)
        expect(style).toMatch(/height:\s*\d+px/)

        // Check that border-radius has px units
        expect(style).toMatch(/border-radius:\s*\d+px/)
    })
})
