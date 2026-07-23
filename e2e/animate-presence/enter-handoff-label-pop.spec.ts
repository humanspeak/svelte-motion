import { expect, test } from '@playwright/test'

/**
 * Regression guard for the pop-layout ENTER-handoff "label pop".
 *
 * On `/tests/animate-presence/layout-button`, clicking the `pop-layout` button
 * swaps "copy" → "copied" while the `layout` button springs to its wider
 * "copied" size (`runBoxSizeAnimation`). The `.state` span (`layout="position"`)
 * should track that growth smoothly (transform stays ~0, seeded each frame).
 * Instead a re-slot commit applies a one-shot enter FLIP transform
 * (`translate3d(~7-16px)`) to `.state` on the first painted frame, which the
 * size-animation guard then clears one frame later — a single-frame ~7.6px
 * rightward pop of the entering "copied" label before it settles.
 *
 * The uncompensated frame is only reliably CAUGHT once the page has been
 * interacted with (rAF sampling aligns with the browser's first paint after a
 * warmup), so this guard performs one throwaway click before the measured run
 * — the same timing regime under which `layout-button.spec.ts` observes it.
 *
 * We sample the readable "copied" `.state-content` label centerX per frame
 * through the enter window and assert no single-pair step exceeds 4px. The
 * legitimate FLIP glide settles at ~1.2-1.7px/frame; the pop is ~7.6px.
 */
const sampleEnterMaxStep = async (page: import('@playwright/test').Page): Promise<number> => {
    await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

    const button = page.getByTestId('pop-layout-button')
    await expect(button).toBeVisible()
    await expect(button).toHaveText('copy')
    await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })

    await button.click()

    const samples = await page.evaluate(async () => {
        const collected: Array<{ centerX: number; opacity: number; text: string; t: number }> = []
        const started = performance.now()
        return await new Promise<typeof collected>((resolve) => {
            const frame = () => {
                const buttonElement = document.querySelector<HTMLElement>(
                    '[data-testid="pop-layout-button"]'
                )
                const labelElements = buttonElement
                    ? Array.from(buttonElement.querySelectorAll<HTMLElement>('.state-content'))
                    : []
                for (const labelElement of labelElements) {
                    const style = getComputedStyle(labelElement)
                    const rect = labelElement.getBoundingClientRect()
                    if (
                        style.display === 'none' ||
                        labelElement.getAttribute('data-presence-wait-hidden') === 'true' ||
                        labelElement.closest('[data-presence-wait-hidden="true"]') ||
                        labelElement.closest('[data-clone="true"]') ||
                        rect.width <= 0 ||
                        rect.height <= 0
                    ) {
                        continue
                    }
                    collected.push({
                        centerX: rect.left + rect.width / 2,
                        opacity: Number.parseFloat(style.opacity),
                        text: labelElement.textContent?.trim() ?? '',
                        t: performance.now() - started
                    })
                }
                if (performance.now() - started < 900) requestAnimationFrame(frame)
                else resolve(collected)
            }
            requestAnimationFrame(frame)
        })
    })

    const readable = samples.filter((sample) => sample.text.includes('copied') && sample.opacity > 0.2)
    expect(readable.length, 'readable copied samples in enter window').toBeGreaterThan(5)

    let maxMove = 0
    for (let i = 1; i < readable.length; i += 1) {
        maxMove = Math.max(maxMove, Math.abs(readable[i].centerX - readable[i - 1].centerX))
    }
    return maxMove
}

test('does not pop the entering copied label on the pop-layout enter handoff', async ({ page }) => {
    test.setTimeout(60000)

    // Warmup interaction: the one-frame pop is only reliably observable once the
    // page's rAF cadence has aligned with paint (matching the failing
    // layout-button.spec.ts run, where pop-layout is the 3rd loop iteration).
    await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')
    const warmupButton = page.getByTestId('pop-layout-button')
    await expect(warmupButton).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })
    await warmupButton.click()
    await page.waitForTimeout(200)

    const maxMove = await sampleEnterMaxStep(page)

    expect(
        maxMove,
        `max single-frame entering-label movement ${maxMove.toFixed(2)}px`
    ).toBeLessThanOrEqual(4)
})
