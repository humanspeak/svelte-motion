import { test, type Page } from '@playwright/test'

/**
 * Skips the running test unless the browser starts optimized appear
 * animations before Motion mounts.
 *
 * The SSR bootstrap waits for the browser's "ready to paint" signal before it
 * starts the WAAPI appear animation. Chromium gives that signal before
 * hydration, so the appear animation runs and Motion hands off from it.
 * Firefox gives it only after Motion has mounted. By then Motion has already
 * started the entrance itself, with the same keyframes and timing, so the
 * bootstrap skips its late start (`window.MotionIsMounted`). A late start
 * would leave a finished `fill: both` animation on the element that overrides
 * every later opacity, filter or transform change.
 *
 * Tests that check the appear animation itself (its samples, its keyframes,
 * the handoff) can only run in Chromium.
 *
 * @param page - The page under test, used to read the browser name.
 */
export function skipUnlessAppearStartsBeforeMount(page: Page): void {
    const browser = page.context().browser()?.browserType().name()
    test.skip(
        browser !== 'chromium',
        'Firefox signals ready to paint only after Motion mounts, so Motion runs the entrance and no appear animation starts'
    )
}
