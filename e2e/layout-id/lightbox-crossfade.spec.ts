import { expect, test, type Page } from '@playwright/test'
import { recordPainted } from '../_helpers/paintedFrames'

/**
 * Plan 012. Verbatim port of upstream motion
 * `packages/framer-motion/cypress/integration/layout-shared-lightbox-crossfade.ts`
 * @ v14.7.1 (`runScriptCrossfade`). Page:
 * src/routes/tests/layout-id/lightbox-crossfade/+page.svelte, a port of
 * `dev/react/src/tests/layout-shared-lightbox-crossfade.tsx` in the owned
 * syntax (see its header).
 *
 * Each cypress `.should` block is an `expect.poll` (cypress retries `.should`
 * for its default timeout; so does `expect.poll`).
 */

interface BoundingBox {
    top: number
    left: number
    width: number
    height: number
}

const read = (page: Page, selector: string) =>
    page.locator(selector).evaluate((element) => {
        const { top, left, width, height } = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
            bbox: { top, left, width, height },
            borderRadius: style.borderRadius,
            opacity: style.opacity
        }
    })

/**
 * `expectBbox`'s exact values, to ±0.01 px (plan 012 amendment A1). With the
 * lightbox at rest (computed `transform: none` on `#parent` and `#child`),
 * the hidden followers are projected onto it with motion-dom's rounded scale
 * strings (`scale(3.33333, …)`), which lay out 0.0006 px short of upstream's
 * exact 600 × 400: floating-point rounding, not a leftover transform.
 */
const roundBox = (bbox: BoundingBox): BoundingBox => {
    const snap = (value: number) =>
        Math.abs(value - Math.round(value)) <= 0.01 ? Math.round(value) : value
    return {
        top: snap(bbox.top),
        left: snap(bbox.left),
        width: snap(bbox.width),
        height: snap(bbox.height)
    }
}

const expectState = (
    page: Page,
    selector: string,
    expected: { bbox: BoundingBox; borderRadius?: string; opacity?: string }
) =>
    expect
        .poll(async () => {
            const state = await read(page, selector)
            return {
                bbox: roundBox(state.bbox),
                ...(expected.borderRadius !== undefined
                    ? { borderRadius: state.borderRadius }
                    : {}),
                ...(expected.opacity !== undefined ? { opacity: state.opacity } : {})
            }
        })
        .toEqual(expected)

async function runScriptCrossfade(page: Page, args: string) {
    await page.setViewportSize({ width: 1000, height: 660 })
    await page.goto(`/tests/layout-id/lightbox-crossfade?@isPlaywright=true${args}`)
    await expect(page.locator('[data-hydrated]')).toBeAttached()
    await page.waitForTimeout(50)
    await expectState(page, '#item-parent', {
        bbox: { top: 40, left: 210, width: 180, height: 580 }
    })
    await expectState(page, '#item-child', {
        bbox: { top: 305, left: 275, width: 50, height: 50 }
    })

    // Open lightbox
    await page.locator('#item-child').click()
    await page.waitForTimeout(50)
    await expectState(page, '#item-parent', {
        borderRadius: '8.33333% / 12.5%',
        opacity: '0',
        bbox: { top: 130, left: 200, width: 600, height: 400 }
    })
    await expectState(page, '#item-child', {
        borderRadius: '50%',
        opacity: '0',
        bbox: { top: 180, left: 250, width: 50, height: 50 }
    })
    await expectState(page, '#parent', {
        borderRadius: '50px',
        opacity: '1',
        bbox: { top: 130, left: 200, width: 600, height: 400 }
    })
    await expectState(page, '#child', {
        borderRadius: '25px',
        opacity: '0.5',
        bbox: { top: 180, left: 250, width: 50, height: 50 }
    })

    // Close lightbox
    await page.locator('#overlay').click()
    await page.waitForTimeout(50)
    await expectState(page, '#item-parent', {
        borderRadius: '0px',
        opacity: '1',
        bbox: { top: 40, left: 210, width: 180, height: 580 }
    })
    await expectState(page, '#item-child', {
        borderRadius: '25px',
        opacity: '0.5',
        bbox: { top: 305, left: 275, width: 50, height: 50 }
    })
}

test('Correctly animates between items and lightbox with instant transition', async ({ page }) => {
    await runScriptCrossfade(page, '&instant=true')
})

test('Correctly animates between items and lightbox with very fast transition', async ({
    page
}) => {
    await runScriptCrossfade(page, '')
})

/**
 * Plan 012 A1: the close judged from painted frames, with a 1 s transition
 * (`?duration=1`). Upstream relegates `#parent` on close, so `#item-parent`
 * is promoted at once and animates home, crossfading in, while the lightbox
 * is held and fades out; the lightbox is removed once that animation ends
 * (`MeasureLayout.tsx:188-217`, `PresenceChild.tsx:67-75` @ v14.7.1).
 */
test('Closing: the lightbox is held while the gallery item animates home, then removed', async ({
    page
}) => {
    await page.setViewportSize({ width: 1000, height: 660 })
    await page.goto('/tests/layout-id/lightbox-crossfade?@isPlaywright=true&duration=1')
    await expect(page.locator('[data-hydrated]')).toBeAttached()
    await page.waitForTimeout(50)
    await page.locator('#item-child').click()
    await page.waitForTimeout(1300)

    const { frames, hits } = await recordPainted(
        page,
        () => page.locator('#overlay').click(),
        900,
        [],
        ['#parent', '#item-parent']
    )
    expect(frames.length).toBeGreaterThan(0)
    const judged = hits.filter((hit) => hit.t >= 50 && hit.t <= 850)
    expect(judged.length).toBeGreaterThan(20)
    const widths: number[] = []
    for (const hit of judged) {
        const at = `${hit.t.toFixed(0)}ms`
        expect(hit.counts[0], `lightbox held at ${at}`).toBe(1)
        expect(hit.visible[1], `gallery item painted at ${at}`).toBe(true)
        widths.push(hit.rects[1]!.width)
    }
    // It animates home from the lightbox's 600px box, never back out.
    expect(widths[0]).toBeGreaterThan(450)
    expect(widths.some((w) => w > 250 && w < 450)).toBe(true)
    for (let i = 1; i < widths.length; i++)
        expect(widths[i]).toBeLessThanOrEqual(widths[i - 1] + 0.5)
    // Removed once the 1 s animation has ended.
    await expect.poll(() => page.locator('#parent').count(), { timeout: 1500 }).toBe(0)
    await expectState(page, '#item-parent', {
        borderRadius: '0px',
        opacity: '1',
        bbox: { top: 40, left: 210, width: 180, height: 580 }
    })
})
