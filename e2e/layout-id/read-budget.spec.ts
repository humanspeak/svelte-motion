import { expect, test, type Page } from '@playwright/test'

/**
 * Plan 008: a `layoutId` element measures itself only when an update touches
 * it, like upstream (`willUpdate` → `updateSnapshot` → one read), never on
 * every animation frame just to keep a handoff rect at hand.
 *
 * Reads are counted per element id with the same wrapped
 * `getBoundingClientRect` technique as
 * `layout/layout-group-parity/layout-group-interrupt-measurements.spec.ts`.
 * The spec's own position reads go through the unwrapped original
 * (`__rawRect`) so they never count.
 */
type ReadsWindow = Window & {
    reads: Record<string, number>
    __rawRect: (element: Element) => DOMRect
}

const URL = '/tests/layout-id/read-budget?@isPlaywright=true'

async function visit(page: Page) {
    await page.addInitScript(() => {
        const w = window as unknown as ReadsWindow
        w.reads = {}
        const getBoundingClientRect = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'getBoundingClientRect'
        )!.value as (this: Element) => DOMRect
        w.__rawRect = (element) => getBoundingClientRect.call(element)
        Element.prototype.getBoundingClientRect = function (this: Element) {
            if (this.id) w.reads[this.id] = (w.reads[this.id] || 0) + 1
            return getBoundingClientRect.call(this)
        }
    })
    await page.goto(URL)
    await expect(page.getByTestId('card')).toHaveAttribute('data-is-loaded', 'ready')
    // Let mount-time work (seed read, enter) settle before sampling.
    await page.waitForTimeout(300)
}

const resetReads = (page: Page) =>
    page.evaluate(() => {
        ;(window as unknown as ReadsWindow).reads = {}
    })

const readsOf = (page: Page, id: string) =>
    page.evaluate((target) => (window as unknown as ReadsWindow).reads[target] || 0, id)

/** Visual left of #card (transforms included), read without counting. */
const cardLeft = (page: Page) =>
    page.evaluate(
        () => (window as unknown as ReadsWindow).__rawRect(document.getElementById('card')!).left
    )

/** Native click, then the first frame after the swap: the handoff's start. */
const swapAndSampleFirstFrame = (page: Page) =>
    page.evaluate(async () => {
        const w = window as unknown as ReadsWindow
        document.getElementById('swap')!.click()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        return w.__rawRect(document.getElementById('card')!).left
    })

test.describe('layoutId read budget', () => {
    test('an idle layoutId element makes no layout reads', async ({ page }) => {
        await visit(page)
        await resetReads(page)
        await page.waitForTimeout(500)
        expect(await readsOf(page, 'card')).toBe(0)
    })

    test('the swapped-in element starts from where the departing one was', async ({ page }) => {
        await visit(page)
        const from = await cardLeft(page)
        const startedAt = await swapAndSampleFirstFrame(page)
        // A 1s linear tween moves ~7px per frame; a missing or wrong handoff
        // rect would start in the new slot, ~250px to the right.
        expect(Math.abs(startedAt - from)).toBeLessThan(20)
        await page.waitForTimeout(1300)
        expect(await cardLeft(page)).toBeGreaterThan(from + 200)
    })

    /**
     * A plain-DOM change (no motion update anywhere) moves the idle card down.
     * Upstream measures a departing layoutId node in `unmount()`, so its
     * handoff always starts from where it really was; the Svelte port can't
     * measure at teardown (the DOM is already gone), so it has to notice the
     * move while the card is still mounted.
     */
    test('a handoff after a plain-DOM layout shift starts from the real position', async ({
        page
    }) => {
        await visit(page)
        await resetReads(page)
        const shift = await page.evaluate(() => {
            const w = window as unknown as ReadsWindow
            const card = () => w.__rawRect(document.getElementById('card')!)
            const topBefore = card().top
            const spacer = document.createElement('div')
            spacer.style.height = '120px'
            document.getElementById('card')!.parentElement!.parentElement!.before(spacer)
            return { topBefore, topAfter: card().top }
        })
        expect(shift.topAfter - shift.topBefore).toBeGreaterThan(50)
        await page.waitForTimeout(300)
        // Reacting to one move costs at most a couple of reads, never a loop.
        expect(await readsOf(page, 'card')).toBeLessThanOrEqual(2)

        const firstFrameTop = await page.evaluate(async () => {
            const w = window as unknown as ReadsWindow
            document.getElementById('swap')!.click()
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            return w.__rawRect(document.getElementById('card')!).top
        })
        // Both slots share a top edge, so the horizontal glide must not move
        // the card vertically at all: it starts at the shifted position.
        expect(Math.abs(firstFrameTop - shift.topAfter)).toBeLessThanOrEqual(1)
    })

    test('a swap mid-glide turns around from the on-screen position', async ({ page }) => {
        await visit(page)
        await swapAndSampleFirstFrame(page)
        await page.waitForTimeout(450)
        const midGlide = await cardLeft(page)
        const startedAt = await swapAndSampleFirstFrame(page)
        expect(Math.abs(startedAt - midGlide)).toBeLessThan(20)
    })
})
