import { expect, test } from '@playwright/test'

test.describe('Enter Animation', () => {
    test('should animate from invisible to visible', async ({ page }) => {
        // Navigate with query param
        await page.goto('/tests/motion/enter-animation?@humanspeak-svelte-motion-isPlaywright=true')

        // Wait specifically for the element to appear with initial state
        const element = page.getByTestId('motion-div')

        // Wait for the data-is-loaded attribute to be 'initial'
        await expect(element).toHaveAttribute('data-is-loaded', 'initial')
        await expect(element).toHaveAttribute('data-path', '1')
        await expect(element).toHaveAttribute('data-playwright', 'true')
        await expect(element).toHaveCSS('opacity', '0')

        // Wait and verify final state (CSS-driven)
        await expect(element).toHaveCSS('opacity', '1')
        await expect(element).toHaveCSS('background-color', 'rgb(255, 0, 0)')
        await expect(element).toHaveCSS('border-radius', '50%')
    })
})
