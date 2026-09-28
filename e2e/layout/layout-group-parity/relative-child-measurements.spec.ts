import { expect, test, type Page } from '@playwright/test'

/**
 * Real-layout port of upstream
 * `packages/framer-motion/src/components/LayoutGroup/__tests__/relative-child-measurements.test.tsx`
 * (Motion v13.4.5) against `/tests/layout/relative-children`.
 *
 * #parent shares a LayoutGroup with #expander, so toggling #expander
 * re-measures #parent. Each child is in its own LayoutGroup inherit="id",
 * so it isn't re-measured with #parent and must follow it via its relative
 * target.
 *
 * Upstream mocks getBoundingClientRect in JSDOM and counts calls per element
 * id; here the real method is wrapped with the same counter. The spec's own
 * offset reads go through the unwrapped original (`__rawRect`) so they don't
 * pollute the counts — upstream's `childOffset` likewise calls its `rect()`
 * helper directly rather than the mocked method.
 *
 * Mapping: `update(cb)` = native click on the fixture's toggle button, then
 * two animation frames; `frames(n)` = n animation frames.
 */
type ReadsWindow = Window & {
    reads: Record<string, number>
    __rawRect: (element: Element) => DOMRect
}

async function visit(page: Page, query = '') {
    await page.addInitScript(() => {
        const w = window as unknown as ReadsWindow
        w.reads = {}
        const getBoundingClientRect = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'getBoundingClientRect'
        )!.value as (this: Element) => DOMRect
        w.__rawRect = (element) => getBoundingClientRect.call(element)
        Element.prototype.getBoundingClientRect = function (this: Element) {
            w.reads[this.id] = (w.reads[this.id] || 0) + 1
            return getBoundingClientRect.call(this)
        }
    })
    const separator = query ? '&' : ''
    await page.goto(`/tests/layout/relative-children?${query}${separator}@isPlaywright=true`)
    await page.waitForFunction(() => !!document.getElementById('child0'))
}

const frames = (page: Page, count: number) =>
    page.evaluate(async (n) => {
        for (let i = 0; i < n; i++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
    }, count)

async function update(page: Page, buttonId: string) {
    await page.evaluate((id) => document.getElementById(id)!.click(), buttonId)
    await frames(page, 2)
}

const toggleExpander = (page: Page) => update(page, 'toggle-expander')
const toggleChild = (page: Page, index: number) => update(page, `toggle-child${index}`)

/** Visual offset of a child from #parent (layout offset + own projection). */
const childOffset = (page: Page, id = 'child0') =>
    page.evaluate((childId) => {
        const w = window as unknown as ReadsWindow
        return (
            w.__rawRect(document.getElementById(childId)!).top -
            w.__rawRect(document.getElementById('parent')!).top
        )
    }, id)

const resetReads = (page: Page) =>
    page.evaluate(() => {
        ;(window as unknown as ReadsWindow).reads = {}
    })

const readsOf = (page: Page, id: string) =>
    page.evaluate((target) => (window as unknown as ReadsWindow).reads[target] || 0, id)

const childReads = (page: Page) =>
    page.evaluate(() => {
        const { reads } = window as unknown as ReadsWindow
        let total = 0
        for (const id in reads) if (id.startsWith('child')) total += reads[id]
        return total
    })

test.describe('relative children when their relative parent re-lays out', () => {
    // Red on 2026-09-28: #parent is never re-measured when #expander toggles (reads.parent 0). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail("doesn't measure a child that isn't animating", async ({ page }) => {
        await visit(page)
        await frames(page, 2)

        await toggleExpander(page)
        await frames(page, 3)
        const offset = await childOffset(page)
        await resetReads(page)
        await toggleExpander(page)

        expect(await readsOf(page, 'parent')).toBeGreaterThan(0)
        expect(await childReads(page)).toBe(0)
        expect(await childOffset(page)).toBeCloseTo(offset, 0)
    })

    /**
     * The child started animating while #parent wasn't projecting, so it has
     * no relative target. It still jumps by #parent's layout shift here, as
     * it does without syncRelativeLayout; this only checks it isn't measured.
     */
    // Red on 2026-09-28: #parent is never re-measured when #expander toggles (reads.parent 0). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail(
        "doesn't measure a layout-animating child without a relative target",
        async ({ page }) => {
            await visit(page)
            await frames(page, 2)
            await toggleChild(page, 0)
            await frames(page, 3)
            expect(
                await page.evaluate(() => document.getElementById('child0')!.style.transform)
            ).toContain('translate')

            await resetReads(page)
            await toggleExpander(page)

            expect(await readsOf(page, 'parent')).toBeGreaterThan(0)
            expect(await childReads(page)).toBe(0)
        }
    )

    // Red on 2026-09-28: animating child0 is not re-measured on #expander toggle (reads 0, expected 1). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail("measures a layout-animating child once, so it doesn't jump", async ({ page }) => {
        await visit(page)
        await frames(page, 2)
        await toggleExpander(page)
        await toggleChild(page, 0)
        await frames(page, 3)

        const offset = await childOffset(page)
        await resetReads(page)
        await toggleExpander(page)

        expect(await readsOf(page, 'child0')).toBe(1)
        expect(Math.abs((await childOffset(page)) - offset)).toBeLessThan(1)
    })

    test("doesn't measure a child whose animation finished while its parent is still animating", async ({
        page
    }) => {
        await visit(page, 'childTransition=short')
        await frames(page, 2)
        await toggleExpander(page)
        await toggleChild(page, 0)
        await page.waitForTimeout(300)
        await frames(page, 2)

        const offset = await childOffset(page)
        await resetReads(page)
        await toggleExpander(page)

        expect(await childReads(page)).toBe(0)
        expect(Math.abs((await childOffset(page)) - offset)).toBeLessThan(1)
    })

    test("doesn't measure a child whose animation finished once the tree settled", async ({
        page
    }) => {
        await visit(page, 'childTransition=short')
        await frames(page, 2)
        await toggleChild(page, 0)
        await page.waitForTimeout(300)
        await frames(page, 2)

        await resetReads(page)
        await toggleExpander(page)

        expect(await childReads(page)).toBe(0)
    })

    // Red on 2026-09-28: animating children are not re-measured on #expander toggles (reads 0, expected 50). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail(
        'measures each layout-animating child once per parent re-layout',
        async ({ page }) => {
            await visit(page, 'children=10')
            await frames(page, 2)
            await toggleExpander(page)
            for (let i = 0; i < 10; i++) await toggleChild(page, i)
            await frames(page, 3)

            await resetReads(page)
            for (let i = 0; i < 5; i++) {
                const offsets: number[] = []
                for (let c = 0; c < 10; c++) offsets.push(await childOffset(page, `child${c}`))

                await toggleExpander(page)

                for (let c = 0; c < 10; c++) {
                    expect(
                        Math.abs((await childOffset(page, `child${c}`)) - offsets[c]),
                        `child${c} offset after expander toggle ${i + 1}`
                    ).toBeLessThan(1)
                }
            }

            expect(await childReads(page)).toBe(50)
        }
    )
})
