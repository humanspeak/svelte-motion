import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/use-presence-data?@isPlaywright=true'

async function waitForSettledCard(page: Page, card: string) {
    await page.waitForFunction(
        (expectedCard) => {
            const el = document.querySelector('[data-testid="presence-data-card"]')
            if (!(el instanceof HTMLElement)) return false
            if (el.dataset.clone === 'true') return false
            if (el.dataset.card !== expectedCard) return false

            const style = getComputedStyle(el)
            return Number.parseFloat(style.opacity) > 0.98
        },
        card,
        { timeout: 5000 }
    )
}

async function waitForExitingCardX(page: Page, direction: 'left' | 'right') {
    const threshold = direction === 'left' ? -18 : 18

    await page.waitForFunction(
        ({ expectedDirection, expectedThreshold }) => {
            const clone = document.querySelector(
                '[data-testid="presence-data-card"][data-clone="true"]'
            )
            if (!(clone instanceof HTMLElement)) return false

            const matrix = new DOMMatrixReadOnly(getComputedStyle(clone).transform)
            return expectedDirection === 'left'
                ? matrix.m41 < expectedThreshold
                : matrix.m41 > expectedThreshold
        },
        { expectedDirection: direction, expectedThreshold: threshold },
        { timeout: 5000 }
    )
}

test.describe('usePresenceData', () => {
    test('returns undefined outside AnimatePresence and tracks custom data inside it', async ({
        page
    }) => {
        await page.goto(URL)

        const probes = page.getByTestId('presence-data-probe')
        await expect(probes.nth(0)).toHaveAttribute('data-value', 'undefined')
        await expect(probes.nth(1)).toHaveAttribute('data-value', '1')

        await page.getByTestId('presence-data-prev').click()
        await expect(page.getByTestId('presence-data-direction')).toHaveText('direction -1')
        await expect(probes.nth(1)).toHaveAttribute('data-value', '-1')
    })

    test('moves the exiting child from the latest custom direction on first previous click', async ({
        page
    }) => {
        await page.goto(URL)
        await waitForSettledCard(page, 'alpha')

        await page.getByTestId('presence-data-prev').click()
        await waitForExitingCardX(page, 'right')
        await waitForSettledCard(page, 'charlie')
    })

    test('moves the exiting child from the latest custom direction on next click', async ({
        page
    }) => {
        await page.goto(URL)
        await waitForSettledCard(page, 'alpha')

        await page.getByTestId('presence-data-next').click()
        await waitForExitingCardX(page, 'left')
        await waitForSettledCard(page, 'bravo')
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: 'usePresenceData' })).toHaveAttribute(
            'href',
            /\/tests\/use-presence-data/
        )
    })
})
