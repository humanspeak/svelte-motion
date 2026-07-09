import { expect, test } from '@playwright/test'
import { waitForViewAnimation, waitForViewAnimationsToFinish } from '../_helpers/view'

test.describe('view/shared-element', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/view/shared-element?@isPlaywright=true')
        await page.getByTestId('grid').waitFor({ state: 'visible' })
    })

    test('morphs a thumbnail into the detail hero and back', async ({ page }) => {
        await page.getByTestId('thumb-jade').click()

        // During the morph the paired layer animates as a view-transition
        // group (the .add(thumb, hero) shared-element pair).
        await waitForViewAnimation(page)

        await expect(page.getByTestId('detail-title')).toHaveText('Jade Motion')
        await expect(page.getByTestId('grid')).toHaveCount(0)

        await page.getByTestId('close').click()
        await expect(page.getByTestId('grid')).toBeVisible()
        await expect(page.getByTestId('thumb-jade')).toBeVisible()
    })

    test('temporary view-transition-names are cleaned up after the morph', async ({ page }) => {
        await page.getByTestId('thumb-coral').click()
        await expect(page.getByTestId('detail-title')).toHaveText('Coral Dreams')

        // Wait for the transition to fully finish, then confirm no inline
        // view-transition-name lingers on the hero.
        await waitForViewAnimation(page)
        await waitForViewAnimationsToFinish(page)
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const hero = document.querySelector<HTMLElement>('[data-hero]')
                    return hero?.style.viewTransitionName || ''
                })
            )
            .toBe('')
    })
})
