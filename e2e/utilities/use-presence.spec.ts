import { expect, test } from '@playwright/test'

test.describe('usePresence', () => {
    test('owned group retains both descendants after the fast exit and removes once after the slow exit', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')
        await page.getByTestId('group-hide').click()
        await expect(page.getByTestId('group-fast-state')).toHaveText('finished')
        await expect(page.getByTestId('group-slow-state')).toHaveText('exiting')
        const slowProgress = await page
            .locator('.group-demo .progress progress')
            .nth(1)
            .evaluate((element: HTMLProgressElement) => element.value)
        expect(slowProgress).toBeGreaterThan(0)
        expect(slowProgress).toBeLessThan(100)
        await expect(page.getByTestId('group-mounted')).toHaveText('mounted')
        await expect(page.getByTestId('group-fast-card')).toBeAttached()
        await expect(page.getByTestId('group-slow-card')).toBeAttached()
        await expect(page.getByTestId('group-completions')).toHaveText('0')
        await expect(page.getByTestId('owned-group-wrapper')).toHaveCount(0)
        await expect(page.getByTestId('group-slow-state')).toHaveText('finished')
        await expect(page.getByTestId('group-mounted')).toHaveText('removed')
        await expect(page.getByTestId('group-completions')).toHaveText('1')
        await page.getByTestId('group-show').click()
        await expect(page.getByTestId('owned-group-wrapper')).toBeVisible()
        await page.getByTestId('group-hide').click()
        await expect(page.getByTestId('owned-group-wrapper')).toHaveCount(0)
        await expect(page.getByTestId('group-completions')).toHaveText('2')
    })

    test('owned group cancels an exit, starts another, and resets its real lifecycle metrics', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')
        await page.getByTestId('group-hide').click()
        await expect(page.getByTestId('group-fast-state')).toHaveText('finished')
        await page.getByTestId('group-show').click()
        await expect(page.getByTestId('group-fast-state')).toHaveText('ready')
        await expect(page.getByTestId('group-completions')).toHaveText('0')
        await page.getByTestId('group-hide').click()
        await expect(page.getByTestId('group-slow-state')).toHaveText('exiting')
        await expect(page.getByTestId('owned-group-wrapper')).toBeAttached()
        await expect(page.getByTestId('owned-group-wrapper')).toHaveCount(0)
        await expect(page.getByTestId('group-completions')).toHaveText('1')
        await page.getByTestId('group-reset').click()
        await expect(page.getByTestId('group-fast-state')).toHaveText('ready')
        await expect(page.getByTestId('group-slow-state')).toHaveText('ready')
        await expect(page.getByTestId('group-mounted')).toHaveText('mounted')
        await expect(page.getByTestId('group-completions')).toHaveText('0')
    })

    test('owned group restores both retained cards when shown after the fast exit finishes', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')
        const cards = page.locator(
            '[data-testid="group-fast-card"], [data-testid="group-slow-card"]'
        )
        await expect(cards).toHaveCount(2)
        const originalCards = await cards.elementHandles()
        expect(originalCards).toHaveLength(2)

        for (let cycle = 0; cycle < 2; cycle += 1) {
            await page.getByTestId('group-hide').click()
            await expect(page.getByTestId('group-fast-state')).toHaveText('finished')
            await expect(page.getByTestId('group-slow-state')).toHaveText('exiting')
            await page.getByTestId('group-show').click()

            for (const [index, original] of originalCards.entries()) {
                expect(
                    await cards.nth(index).evaluate((node, before) => node === before, original)
                ).toBe(true)
            }
            await expect
                .poll(() =>
                    cards.evaluateAll((elements) =>
                        elements.map((element) => {
                            const style = getComputedStyle(element)
                            return {
                                opacity: Number(style.opacity),
                                x:
                                    style.transform === 'none'
                                        ? 0
                                        : new DOMMatrixReadOnly(style.transform).m41
                            }
                        })
                    )
                )
                .toEqual([
                    { opacity: expect.closeTo(1, 2), x: expect.closeTo(0, 0) },
                    { opacity: expect.closeTo(1, 2), x: expect.closeTo(0, 0) }
                ])
            await expect(page.getByTestId('group-completions')).toHaveText('0')
        }

        await page.getByTestId('group-hide').click()
        await expect(page.getByTestId('owned-group-wrapper')).toHaveCount(0)
        await expect(page.getByTestId('group-completions')).toHaveText('1')
    })

    test('owned group reduced-motion exits finish with accurate metrics', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto('/tests/use-presence')
        await page.getByTestId('group-hide').click()
        await expect(page.getByTestId('owned-group-wrapper')).toHaveCount(0)
        await expect(page.getByTestId('group-fast-state')).toHaveText('finished')
        await expect(page.getByTestId('group-slow-state')).toHaveText('finished')
        await expect(page.getByTestId('group-completions')).toHaveText('1')
    })

    test('owned motion child survives a rapid hide/show/hide until the current exit completes', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')
        const card = page.getByTestId('owned-motion-card')
        const phase = page.getByTestId('owned-phase')
        await expect(card).toBeVisible()
        await card.evaluate((element) => (element.dataset.marker = 'original'))
        await page.getByTestId('replay-owned').click()

        await expect(phase).toHaveText('exit A')
        await expect(card).toHaveAttribute('data-marker', 'original')
        await expect(phase).toHaveText('reentered')
        await expect(card).toHaveAttribute('data-marker', 'original')
        await expect(phase).toHaveText('exit B')
        await expect(card).toHaveAttribute('data-marker', 'original')
        await expect(page.getByTestId('owned-completions')).toHaveText(
            'completion notifications: 1'
        )
        await expect(card).toHaveCount(0, { timeout: 4000 })
        await expect(phase).toHaveText('removed')
        await expect(page.getByTestId('owned-completions')).toHaveText(
            'completion notifications: 2'
        )

        await page.getByTestId('replay-owned').click()
        await expect(card).toBeAttached()
        await expect(phase).toHaveText('exit B')
        await expect(card).toBeAttached()
        await expect(card).toHaveCount(0, { timeout: 4000 })
        await expect(page.getByTestId('owned-completions')).toHaveText(
            'completion notifications: 4'
        )
    })

    test('reset cancels the owned child replay timers', async ({ page }) => {
        await page.goto('/tests/use-presence')
        const card = page.getByTestId('owned-motion-card')
        await page.getByTestId('replay-owned').click()
        await expect(page.getByTestId('owned-phase')).toHaveText('exit A')
        await page.getByTestId('reset-owned').click()
        await expect(page.getByTestId('owned-phase')).toHaveText('ready')
        await expect(card).toBeVisible()
        await expect(page.getByTestId('replay-owned')).toBeEnabled()
        await page.getByTestId('toggle-owned').click()
        await expect(card).toHaveCount(0, { timeout: 4000 })
        await expect(page.getByTestId('owned-phase')).toHaveText('removed')
    })

    test('basic toggle: card stays mounted during exit transition then unmounts', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')

        const card = page.getByTestId('card')
        await expect(card).toBeVisible()
        await expect(card).toHaveAttribute('data-is-present', 'true')

        // Mark the element so we can detect remount.
        await card.evaluate((el) => (el.dataset.marker = 'pre-hide'))

        await page.getByTestId('toggle-basic').click()

        // While exiting, the same element is still in the DOM (no remount —
        // confirms the effect.pre fix), and its data-is-present has flipped.
        await expect(card).toHaveAttribute('data-is-present', 'false')
        await expect(card).toHaveAttribute('data-marker', 'pre-hide')

        // After the 300ms CSS transition + safeToRemove, the card is gone and
        // AnimatePresence's onExitComplete has fired exactly once.
        await expect(card).toHaveCount(0, { timeout: 2000 })
        await expect(page.getByTestId('exits-completed')).toHaveText('exitsCompleted: 1')
    })

    test('clicking Show after Hide brings the card back', async ({ page }) => {
        await page.goto('/tests/use-presence')

        await page.getByTestId('toggle-basic').click()
        await expect(page.getByTestId('card')).toHaveCount(0, { timeout: 2000 })

        await page.getByTestId('toggle-basic').click()
        await expect(page.getByTestId('card')).toBeVisible()
        await expect(page.getByTestId('card')).toHaveAttribute('data-is-present', 'true')
    })

    test('swap: wait mode holds each incoming PresenceChild until safeToRemove fires', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')

        await expect(page.getByTestId('wait-a')).toBeVisible()
        await expect(page.getByTestId('wait-b')).toHaveCount(0)

        await page.getByTestId('toggle-wait').click()

        // A exits alone. B must not enter until A calls safeToRemove.
        await expect(page.getByTestId('wait-a')).toHaveAttribute('data-is-present', 'false')
        await expect(page.getByTestId('wait-b')).toHaveCount(0)

        // Eventually A's transitionend fires, triggering safeToRemove and B's enter.
        await expect(page.getByTestId('wait-a')).toHaveCount(0, { timeout: 5000 })
        await expect(page.getByTestId('wait-b')).toHaveAttribute('data-is-present', 'true')

        await page.getByTestId('toggle-wait').click()

        // The reverse direction should behave the same way. This catches the
        // sibling update-order case where A can observe present=true before B
        // has announced its exit.
        await expect(page.getByTestId('wait-b')).toHaveAttribute('data-is-present', 'false')
        await expect(page.getByTestId('wait-a')).toHaveCount(0)

        await expect(page.getByTestId('wait-b')).toHaveCount(0, { timeout: 5000 })
        await expect(page.getByTestId('wait-a')).toHaveAttribute('data-is-present', 'true')
    })
})
