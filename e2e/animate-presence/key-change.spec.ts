import { expect, test } from '@playwright/test'

const URL = '/tests/animate-presence/key-change?@isPlaywright=true'

/** Wait until the box is fully visible: opacity ≥ 0.99 and no blur. */
async function waitForBoxVisible(page: import('@playwright/test').Page, expectedState?: string) {
    await page.waitForFunction(
        (state) => {
            const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
            if (!el) return false
            if (state && el.getAttribute('data-state') !== state) return false
            const cs = getComputedStyle(el)
            const opacity = parseFloat(cs.opacity)
            if (opacity < 0.99) return false
            const filter = cs.filter
            if (filter && filter !== 'none' && !filter.includes('blur(0px)')) return false
            return true
        },
        expectedState ?? null,
        { timeout: 5000 }
    )
}

test.describe('AnimatePresence key-change transitions', () => {
    test('enters animate state after key change', async ({ page }) => {
        await page.goto(URL)

        // Initial state should be fully visible
        await waitForBoxVisible(page, 'one')
        const box = page.locator('[data-testid="box"]')
        await expect(box).toContainText('one')

        // Click to change key
        await page.getByTestId('cycle').click()

        // Wait for new state to be fully visible
        await waitForBoxVisible(page, 'two')
        const newBox = page.locator('[data-testid="box"]')
        await expect(newBox).toHaveAttribute('data-state', 'two')
        await expect(newBox).toContainText('two')
    })

    test('full cycle through all states', async ({ page }) => {
        await page.goto(URL)

        const expectedStates = ['one', 'two', 'three', 'four', 'one']
        const cycle = page.getByTestId('cycle')

        // Verify initial state
        await waitForBoxVisible(page, 'one')

        for (let i = 1; i < expectedStates.length; i++) {
            await cycle.click()
            await waitForBoxVisible(page, expectedStates[i])

            const box = page.locator('[data-testid="box"]')
            await expect(box).toHaveAttribute('data-state', expectedStates[i])
            await expect(box).toContainText(expectedStates[i])
        }
    })

    test('exit animation runs before enter', async ({ page }) => {
        await page.goto(URL)
        await waitForBoxVisible(page, 'one')

        // Click to trigger key change
        await page.getByTestId('cycle').click()

        // Sample intermediate values during the transition
        const samples: { opacity: number; filter: string; state: string | null }[] = []
        const start = Date.now()
        while (Date.now() - start < 1500 && samples.length < 30) {
            const sample = await page.evaluate(() => {
                const el = document.querySelector('[data-testid="box"]') as HTMLElement | null
                if (!el) return null
                const cs = getComputedStyle(el)
                return {
                    opacity: parseFloat(cs.opacity),
                    filter: cs.filter || 'none',
                    state: el.getAttribute('data-state')
                }
            })
            if (sample) samples.push(sample)
            await page.waitForTimeout(50)
        }

        // At least some samples should show mid-animation values (opacity < 0.95 or blur > 0)
        const hasAnimatedValues = samples.some(
            (s) => s.opacity < 0.95 || (s.filter !== 'none' && !s.filter.includes('blur(0px)'))
        )
        expect(hasAnimatedValues).toBe(true)

        // Final state should be fully visible with new state
        await waitForBoxVisible(page, 'two')
    })

    test('rapid state changes do not leave elements stuck', async ({ page }) => {
        await page.goto(URL)
        await waitForBoxVisible(page, 'one')

        // Click rapidly without waiting for transitions
        const cycle = page.getByTestId('cycle')
        await cycle.click()
        await cycle.click()
        await cycle.click()

        // After 3 clicks from "one": one→two→three→four
        // Wait for all animations to settle
        await page.waitForTimeout(2000)

        // Should have exactly 1 visible box element with the final state
        await page.waitForFunction(
            () => {
                const boxes = document.querySelectorAll('[data-testid="box"]')
                if (boxes.length !== 1) return false
                const el = boxes[0] as HTMLElement
                const cs = getComputedStyle(el)
                return parseFloat(cs.opacity) >= 0.99
            },
            { timeout: 5000 }
        )

        const box = page.locator('[data-testid="box"]')
        await expect(box).toHaveCount(1)
        await expect(box).toHaveAttribute('data-state', 'four')
        await expect(box).toContainText('four')
    })
})
