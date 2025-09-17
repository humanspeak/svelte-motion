import { expect, test } from '@playwright/test'

test.describe('Enter Animation', () => {
    test('should animate from invisible to visible', async ({ page }) => {
        // Navigate with query param
        await page.goto('/tests/motion/enter-animation?@humanspeak-svelte-motion-isPlaywright=true')

        // Wait specifically for the element to appear with initial state
        const element = page.getByTestId('motion-div')

        // Ensure we are on the initial code path for Playwright
        await expect(element).toHaveAttribute('data-path', '1')
        await expect(element).toHaveAttribute('data-playwright', 'true')

        // Some runners may promote to 'ready' very fast; accept both states.
        const state = await element.getAttribute('data-is-loaded')
        if (state === 'initial') {
            await expect(element).toHaveCSS('opacity', '0')
            // Then it should promote to ready
            await expect(element).toHaveAttribute('data-is-loaded', 'ready')
        } else {
            expect(state).toBe('ready')
        }

        // Wait and verify final state (CSS-driven)
        await expect(element).toHaveCSS('opacity', '1')
        await expect(element).toHaveCSS('background-color', 'rgb(255, 0, 0)')
        await expect(element).toHaveCSS('border-radius', '50%')
    })
})
