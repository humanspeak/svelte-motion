import { expect, test } from '@playwright/test'

/**
 * Regression guard for the wait-mode reset "label pop".
 *
 * On `/tests/animate-presence/layout-button`, clicking the `wait` button swaps
 * "copy" → "copied" and, ~2.4s later (when the button's linear `layout`
 * transition finishes), the exiting/settling "copied" label was observed to
 * jump EXACTLY +8px rightward in a single frame with `transform: none`, then
 * glide back left over ~1s. The jump is caused by `commitObservedLayout`
 * re-seeding the projection cache at the already-moved position instead of
 * committing a FLIP when a presence placeholder is present (early-return
 * branch in `_MotionContainer.svelte`).
 *
 * We sample the readable "copied" `.state-content` label's bounding-box
 * centerX per animation frame across the settle window (~2000ms–3400ms after
 * click), skipping the separate enter handoff (~0–260ms) covered elsewhere.
 * The legitimate FLIP glide on this branch peaks around ~2.2px/frame; the
 * regression is an ~8px single-frame snap. Any single-pair movement above 4px
 * inside the window fails the guard.
 */
test('does not pop the readable copied label during the wait settle window', async ({ page }) => {
    test.setTimeout(60000)

    await page.goto('/tests/animate-presence/layout-button?@isPlaywright=true')

    const button = page.getByTestId('wait-button')
    await expect(button).toBeVisible()
    await expect(button).toHaveText('copy')
    await expect(button).toHaveAttribute('data-is-loaded', 'ready', { timeout: 3000 })

    await button.click()

    // Sample the readable "copied" label per frame through the settle window.
    // `t` is milliseconds since sampling started (immediately after click).
    const samples = await page.evaluate(async () => {
        const collected: Array<{
            centerX: number
            opacity: number
            text: string
            transform: string
            t: number
        }> = []
        const started = performance.now()

        return await new Promise<typeof collected>((resolve) => {
            const frame = () => {
                const buttonElement = document.querySelector<HTMLElement>(
                    '[data-testid="wait-button"]'
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
                        transform: labelElement.style.transform || style.transform,
                        t: performance.now() - started
                    })
                }

                if (performance.now() - started < 3400) requestAnimationFrame(frame)
                else resolve(collected)
            }
            requestAnimationFrame(frame)
        })
    })

    // Readable "copied" label frames inside the settle window (post-enter,
    // through the layout-animation completion where the pop occurs).
    const windowSamples = samples.filter(
        (sample) =>
            sample.text.includes('copied') &&
            sample.opacity > 0.2 &&
            sample.t >= 2000 &&
            sample.t <= 3400
    )

    expect(windowSamples.length, 'readable copied samples in settle window').toBeGreaterThan(5)

    let maxMovement = 0
    let maxMovementAt = 0
    for (let i = 1; i < windowSamples.length; i += 1) {
        const movement = Math.abs(windowSamples[i].centerX - windowSamples[i - 1].centerX)
        if (movement > maxMovement) {
            maxMovement = movement
            maxMovementAt = windowSamples[i].t
        }
    }

    // The pop is a single ~8px frame; legitimate motion peaks near ~2.2px.
    // 4px cleanly separates the two without flaking on merged rAF frames.
    expect(
        maxMovement,
        `max single-frame label movement ${maxMovement.toFixed(2)}px at t≈${Math.round(maxMovementAt)}ms`
    ).toBeLessThanOrEqual(4)
})
