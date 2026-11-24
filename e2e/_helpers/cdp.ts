import { test, type CDPSession, type Page } from '@playwright/test'

/**
 * Opens a Chrome DevTools Protocol session for `page`, or skips the running
 * test when the browser is not Chromium. Playwright only offers CDP in
 * Chromium, so screencast frame capture, CPU throttling and raw touch input
 * cannot run in Firefox; those checks stay covered by the Chromium project.
 *
 * Call it from inside a test (or a helper a test calls): `test.skip` ends the
 * test right there, before any other step runs.
 *
 * @param page - The page to attach the session to.
 * @param need - What the test uses CDP for, shown as the skip reason.
 * @returns The CDP session for `page`.
 *
 * @example
 * ```ts
 * const cdp = await openCdpSession(page, 'Painted-frame capture')
 * await cdp.send('Page.startScreencast', { format: 'png' })
 * ```
 */
export async function openCdpSession(page: Page, need: string): Promise<CDPSession> {
    const browser = page.context().browser()?.browserType().name()
    test.skip(browser !== 'chromium', `${need} needs CDP, which only Chromium has`)
    return page.context().newCDPSession(page)
}
