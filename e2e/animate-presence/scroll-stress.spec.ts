import { expect, type Page, test } from '@playwright/test'

const url = '/tests/animate-presence/basic?@isPlaywright=true'
const manualUrl = '/tests/animate-presence/basic'
const documentScrollUrl = '/tests/animate-presence/document-scroll'

type RectSnapshot = {
    centerX: number
    centerY: number
    height: number
    left: number
    top: number
    width: number
}

const rectSnapshot = async (page: Page, selector: string): Promise<RectSnapshot> => {
    return page.locator(selector).evaluate((el) => {
        const rect = el.getBoundingClientRect()
        return {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width
        }
    })
}

const expectRectNear = (actual: RectSnapshot, expected: RectSnapshot, tolerance = 8) => {
    expect(actual.left).toBeGreaterThanOrEqual(expected.left - tolerance)
    expect(actual.left).toBeLessThanOrEqual(expected.left + tolerance)
    expect(actual.top).toBeGreaterThanOrEqual(expected.top - tolerance)
    expect(actual.top).toBeLessThanOrEqual(expected.top + tolerance)
    expect(actual.width).toBeGreaterThanOrEqual(expected.width - tolerance)
    expect(actual.width).toBeLessThanOrEqual(expected.width + tolerance)
    expect(actual.height).toBeGreaterThanOrEqual(expected.height - tolerance)
    expect(actual.height).toBeLessThanOrEqual(expected.height + tolerance)
}

const expectCenterNear = (actual: RectSnapshot, expected: RectSnapshot, tolerance = 8) => {
    expect(actual.centerX).toBeGreaterThanOrEqual(expected.centerX - tolerance)
    expect(actual.centerX).toBeLessThanOrEqual(expected.centerX + tolerance)
    expect(actual.centerY).toBeGreaterThanOrEqual(expected.centerY - tolerance)
    expect(actual.centerY).toBeLessThanOrEqual(expected.centerY + tolerance)
}

const overlapArea = (a: RectSnapshot, b: RectSnapshot) => {
    const xOverlap = Math.max(
        0,
        Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
    )
    const yOverlap = Math.max(
        0,
        Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
    )

    return xOverlap * yOverlap
}

const expectNoOverlap = (a: RectSnapshot, b: RectSnapshot, message: string) => {
    expect(overlapArea(a, b), message).toBe(0)
}

const expectNearZero = (value: number, message?: string, tolerance = 1) => {
    expect(Math.abs(value), message).toBeLessThanOrEqual(tolerance)
}

const scrollAndRectSnapshot = async (
    page: Page,
    selector: string
): Promise<{ rect: RectSnapshot; scrollTop: number }> => {
    return page.locator('[data-testid="scroll-host"]').evaluate((host, elementSelector) => {
        const element = document.querySelector(elementSelector)
        if (!element) {
            throw new Error(`Element not found: ${elementSelector}`)
        }
        const rect = element.getBoundingClientRect()

        return {
            rect: {
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
                height: rect.height,
                left: rect.left,
                top: rect.top,
                width: rect.width
            },
            scrollTop: host.scrollTop
        }
    }, selector)
}

test.describe('AnimatePresence scroll stress', () => {
    test('keeps exit clone anchored after normal document scrolling', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto(`${documentScrollUrl}?document-scroll-clone`)

        const toggle = page.locator('[data-testid="toggle"]')

        await expect(page.locator('[data-testid="box"]:not([data-clone="true"])')).toBeVisible()
        await page.waitForTimeout(900)

        await page.evaluate(() => window.scrollTo({ top: 180, behavior: 'instant' }))
        await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(80)

        const stageAfterScroll = await rectSnapshot(page, '[data-testid="stage"]')

        await toggle.click()
        await page.waitForTimeout(16)

        const clone = await rectSnapshot(page, '[data-clone="true"]')
        expectCenterNear(clone, stageAfterScroll, 8)
    })

    test('keeps re-entering box centered after scroll hide show interruption', async ({ page }) => {
        await page.setViewportSize({ width: 1452, height: 1324 })
        await page.goto(`${manualUrl}?scroll-hide-show-interrupt`)

        const toggle = page.locator('[data-testid="toggle"]')
        const scrollDown = page.locator('[data-testid="scroll-down"]')

        await expect(page.locator('[data-testid="box"]:not([data-clone="true"])')).toBeVisible()
        await page.waitForTimeout(1200)

        await scrollDown.click()
        await page.waitForTimeout(250)
        await toggle.click()
        await page.waitForTimeout(32)
        await toggle.click()
        await page.waitForTimeout(32)

        const state = await page.evaluate(() => {
            const rectFor = (selector: string) => {
                const element = document.querySelector(selector)
                if (!element) throw new Error(`Element not found: ${selector}`)
                const rect = element.getBoundingClientRect()
                return {
                    centerX: rect.left + rect.width / 2,
                    centerY: rect.top + rect.height / 2,
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            }
            const boxRect = rectFor('[data-testid="box"]:not([data-clone="true"])')
            const stageRect = rectFor('[data-testid="stage"]')
            const diagnostics = document
                .querySelector('[data-testid="diagnostics"]')
                ?.textContent?.replace(/\s+/g, ' ')
                .trim()

            return {
                boxCenterOffset: Math.round(
                    boxRect.centerX - (stageRect.left + stageRect.width / 2)
                ),
                boxRect,
                diagnostics,
                stageRect
            }
        })

        expectNearZero(state.boxCenterOffset, state.diagnostics)
    })

    test('keeps clone centered after scrolling with the page control then hiding', async ({
        page
    }) => {
        await page.setViewportSize({ width: 1452, height: 1324 })
        await page.goto(`${manualUrl}?scroll-button-then-hide`)

        const toggle = page.locator('[data-testid="toggle"]')
        const scrollDown = page.locator('[data-testid="scroll-down"]')

        await expect(page.locator('[data-testid="box"]:not([data-clone="true"])')).toBeVisible()
        await page.waitForTimeout(1200)

        await scrollDown.click()
        await expect
            .poll(() =>
                page
                    .locator('[data-testid="scroll-host"]')
                    .evaluate((host) => Math.round(host.scrollTop))
            )
            .toBeGreaterThan(100)

        await toggle.click()
        await page.waitForTimeout(32)

        const state = await page.evaluate(() => {
            const rectFor = (selector: string) => {
                const element = document.querySelector(selector)
                if (!element) throw new Error(`Element not found: ${selector}`)
                const rect = element.getBoundingClientRect()
                return {
                    centerX: rect.left + rect.width / 2,
                    centerY: rect.top + rect.height / 2,
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            }
            const cloneRect = rectFor('[data-clone="true"]')
            const placeholderRect = rectFor('[data-presence-placeholder="true"]')
            const cloneStyle = getComputedStyle(document.querySelector('[data-clone="true"]')!)
            const diagnostics = document
                .querySelector('[data-testid="diagnostics"]')
                ?.textContent?.replace(/\s+/g, ' ')
                .trim()

            return {
                cloneRect,
                cloneStyleLeft: Math.round(parseFloat(cloneStyle.left) || 0),
                diagnostics,
                dx: Math.round(cloneRect.centerX - placeholderRect.centerX),
                placeholderRect
            }
        })

        expectCenterNear(state.cloneRect, state.placeholderRect, 2)
        expectNearZero(state.cloneStyleLeft, state.diagnostics)
        expectNearZero(state.dx, state.diagnostics)
    })

    test('keeps a scrolled exit clone centered on its placeholder', async ({ page }) => {
        await page.setViewportSize({ width: 1452, height: 1324 })
        await page.goto(`${manualUrl}?scrolled-placeholder-center`)

        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(page.locator('[data-testid="box"]:not([data-clone="true"])')).toBeVisible()
        await page.waitForTimeout(1200)
        await scrollHost.evaluate((host) => {
            host.scrollTo({ top: 404, behavior: 'instant' })
        })
        await expect.poll(() => scrollHost.evaluate((host) => Math.round(host.scrollTop))).toBe(404)

        await toggle.click()

        const clone = page.locator('[data-clone="true"]')
        const placeholder = page.locator('[data-presence-placeholder="true"]')
        await expect(clone).toBeVisible()
        await expect(placeholder).toHaveCount(1)

        const state = await page.evaluate(() => {
            const rectFor = (selector: string) => {
                const element = document.querySelector(selector)
                if (!element) throw new Error(`Element not found: ${selector}`)
                const rect = element.getBoundingClientRect()
                return {
                    centerX: rect.left + rect.width / 2,
                    centerY: rect.top + rect.height / 2,
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            }
            const cloneRect = rectFor('[data-clone="true"]')
            const placeholderRect = rectFor('[data-presence-placeholder="true"]')
            const cloneStyle = getComputedStyle(document.querySelector('[data-clone="true"]')!)

            return {
                cloneRect,
                cloneStyleLeft: Math.round(parseFloat(cloneStyle.left) || 0),
                diagnostics: document
                    .querySelector('[data-testid="diagnostics"]')
                    ?.textContent?.replace(/\s+/g, ' ')
                    .trim(),
                placeholderRect
            }
        })

        expectCenterNear(state.cloneRect, state.placeholderRect, 2)
        expect(state.cloneStyleLeft, state.diagnostics).toBe(0)
        expect(state.diagnostics).toContain('delta dx 0')
    })

    test('honors an early hide click after the page is scrolled', async ({ page }) => {
        await page.setViewportSize({ width: 1452, height: 1324 })
        await page.goto(`${manualUrl}?early-scroll-click`)

        const box = page.locator('[data-testid="box"]:not([data-clone="true"])')
        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(box).toBeVisible()
        await page.waitForTimeout(200)
        await scrollHost.evaluate((host) => {
            host.scrollTo({ top: 120, behavior: 'instant' })
        })

        await toggle.click()

        await expect(page.locator('[data-testid="state-label"]')).toContainText('hidden')
        await expect(toggle).toContainText('Show')
    })

    test('keeps diagnostics in sync when hiding during a scrolled enter animation', async ({
        page
    }) => {
        await page.setViewportSize({ width: 768, height: 1324 })
        await page.goto(`${manualUrl}?diagnostics-enter-scroll`)

        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(page.locator('[data-testid="box"]:not([data-clone="true"])')).toBeVisible()
        await page.waitForTimeout(180)
        await scrollHost.evaluate((host) => {
            host.scrollTo({ top: 120, behavior: 'instant' })
        })

        await toggle.evaluate((button) => {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
        await page.waitForTimeout(20)

        const domState = await page.evaluate(() => ({
            clones: document.querySelectorAll('[data-clone="true"]').length,
            liveBoxes: document.querySelectorAll('[data-testid="box"]:not([data-clone="true"])')
                .length
        }))
        const diagnostics = await page.locator('[data-testid="diagnostics"]').textContent()

        expect(domState.liveBoxes).toBe(0)
        expect(domState.clones).toBe(1)
        expect(diagnostics).toContain('box missing')
        expect(diagnostics).toContain('clone x')
    })

    test('anchors the exit clone to the original rect when hidden from a scrolled container', async ({
        page
    }) => {
        await page.goto(url)

        const box = page.locator('[data-testid="box"]')
        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(box).toBeVisible()
        await scrollHost.evaluate((host) => {
            host.scrollTo({ top: 420, behavior: 'instant' })
        })
        await expect
            .poll(() => scrollHost.evaluate((host) => Math.round(host.scrollTop)))
            .toBeGreaterThan(350)

        const originalRect = await rectSnapshot(page, '[data-testid="box"]')

        await toggle.evaluate((button) => {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
        const clone = page.locator('[data-clone="true"]')
        await expect(clone).toHaveCount(1)

        const cloneRect = await rectSnapshot(page, '[data-clone="true"]')
        expectRectNear(cloneRect, originalRect)

        await expect(clone).toHaveCount(0, { timeout: 3000 })
    })

    test('keeps the exit clone aligned while Hide + scroll moves the container', async ({
        page
    }) => {
        await page.goto(url)

        const box = page.locator('[data-testid="box"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')
        const stress = page.locator('[data-testid="hide-and-scroll"]')

        await expect(box).toBeVisible()
        const originalRect = await rectSnapshot(page, '[data-testid="box"]')

        await stress.click()
        const clone = page.locator('[data-clone="true"]')
        await expect(clone).toBeVisible()
        await expect
            .poll(() => scrollHost.evaluate((host) => Math.round(host.scrollTop)))
            .toBeGreaterThan(100)
        const { rect: cloneRect, scrollTop } = await scrollAndRectSnapshot(
            page,
            '[data-clone="true"]'
        )
        expectCenterNear(
            cloneRect,
            {
                ...originalRect,
                centerY: originalRect.centerY - scrollTop
            },
            32
        )

        await expect(clone).toHaveCount(0, { timeout: 3000 })
        await expect(box).toHaveCount(0)
    })

    test('does not leave a live box after hiding from a manually scrolled spring demo', async ({
        page
    }) => {
        await page.setViewportSize({ width: 768, height: 1024 })
        await page.goto(`${manualUrl}?manual-spring-scroll`)

        const box = page.locator('[data-testid="box"]:not([data-clone="true"])')
        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(box).toBeVisible()
        await scrollHost.evaluate((host) => {
            host.scrollTo({ top: 120, behavior: 'instant' })
        })
        await expect
            .poll(() => scrollHost.evaluate((host) => Math.round(host.scrollTop)))
            .toBeGreaterThan(100)

        await toggle.click()
        await expect(page.locator('[data-clone="true"]')).toHaveCount(0, { timeout: 3000 })
        await expect(box).toHaveCount(0)

        await expect(page.getByText('State: hidden')).toBeVisible()
    })

    test('keeps hidden state from reviving the live box after rapid scroll and hide', async ({
        page
    }) => {
        await page.setViewportSize({ width: 768, height: 1180 })
        await page.goto(`${manualUrl}?rapid-scroll-hide`)

        const box = page.locator('[data-testid="box"]:not([data-clone="true"])')
        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(box).toBeVisible()
        await scrollHost.evaluate((host) => {
            host.scrollBy({ top: 160, behavior: 'smooth' })
        })
        await expect
            .poll(() => scrollHost.evaluate((host) => Math.round(host.scrollTop)))
            .toBeGreaterThan(40)

        await toggle.click()
        await expect(page.locator('[data-clone="true"]')).toHaveCount(0, { timeout: 3000 })

        const state = await page.locator('[data-testid="diagnostics"]').evaluate((diagnostics) => ({
            diagnostics: diagnostics.textContent?.replace(/\s+/g, ' ').trim(),
            liveBoxes: document.querySelectorAll('[data-testid="box"]:not([data-clone="true"])')
                .length,
            clones: document.querySelectorAll('[data-clone="true"]').length
        }))

        expect(state.liveBoxes, state.diagnostics).toBe(0)
        expect(state.clones, state.diagnostics).toBe(0)
    })

    test('keeps the box from overlapping counters after manual scroll and re-enter', async ({
        page
    }) => {
        await page.setViewportSize({ width: 768, height: 1180 })
        await page.goto(`${manualUrl}?overlap-reenter`)

        const box = page.locator('[data-testid="box"]:not([data-clone="true"])')
        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(box).toBeVisible()
        await scrollHost.evaluate((host) => {
            host.scrollTo({ top: 120, behavior: 'instant' })
        })

        await toggle.click()
        await expect(page.locator('[data-clone="true"]')).toHaveCount(0, { timeout: 3000 })
        await toggle.click()
        await expect(box).toBeVisible()

        const boxRect = await rectSnapshot(page, '[data-testid="box"]:not([data-clone="true"])')
        const countersRect = await rectSnapshot(page, '[data-testid="counters"]')
        const controlsRect = await rectSnapshot(page, '[data-testid="controls"]')

        expectNoOverlap(boxRect, countersRect, 'box should not overlap the counter strip')
        expectNoOverlap(boxRect, controlsRect, 'box should not overlap controls')
    })

    test('keeps the exiting clone from overlapping counters while scrolled', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1180 })
        await page.goto(`${manualUrl}?overlap-exit`)

        const toggle = page.locator('[data-testid="toggle"]')
        const scrollHost = page.locator('[data-testid="scroll-host"]')

        await expect(page.locator('[data-testid="box"]:not([data-clone="true"])')).toBeVisible()
        await scrollHost.evaluate((host) => {
            host.scrollTo({ top: 120, behavior: 'instant' })
        })
        await toggle.click()

        const clone = page.locator('[data-clone="true"]')
        await expect(clone).toBeVisible()

        const cloneRect = await rectSnapshot(page, '[data-clone="true"]')
        const countersRect = await rectSnapshot(page, '[data-testid="counters"]')
        const controlsRect = await rectSnapshot(page, '[data-testid="controls"]')

        expectNoOverlap(
            cloneRect,
            countersRect,
            'exiting clone should not overlap the counter strip'
        )
        expectNoOverlap(cloneRect, controlsRect, 'exiting clone should not overlap controls')
    })
})
