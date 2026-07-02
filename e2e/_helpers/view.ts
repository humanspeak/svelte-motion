import type { Page } from '@playwright/test'

/**
 * Whether any view-transition pseudo-element animation is live.
 * Evaluated in the page.
 */
const hasViewAnimation = () =>
    document
        .getAnimations()
        .some((animation) =>
            /view-transition/.test((animation.effect as KeyframeEffect | null)?.pseudoElement ?? '')
        )

/**
 * Wait until a view-transition pseudo-element animation is live. A
 * single sample races the transition's async setup (snapshot capture
 * happens a frame or two after the trigger), so this polls on rAF via
 * `waitForFunction`. Throws with timeout diagnostics if none appears.
 */
export const waitForViewAnimation = (page: Page, timeout = 2000) =>
    page.waitForFunction(hasViewAnimation, undefined, { timeout, polling: 'raf' })

/**
 * Wait until every view-transition pseudo-element animation has
 * finished — the condition-based replacement for sleeping past a
 * transition's duration.
 */
export const waitForViewAnimationsToFinish = (page: Page, timeout = 5000) =>
    page.waitForFunction(
        () =>
            !document
                .getAnimations()
                .some((animation) =>
                    /view-transition/.test(
                        (animation.effect as KeyframeEffect | null)?.pseudoElement ?? ''
                    )
                ),
        undefined,
        { timeout, polling: 'raf' }
    )
