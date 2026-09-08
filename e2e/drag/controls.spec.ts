import { expect, test, type Locator, type Page } from '@playwright/test'

type PointerDownSnapshot = {
    clientX: number
    clientY: number
    pointerType: string
    isPrimary: boolean
    button: number
    buttons: number
}

const installControlObservers = async (handle: Locator, target: Locator) => {
    await handle.evaluate((node) => {
        node.addEventListener('pointerdown', (event) => {
            const pointerEvent = event as PointerEvent
            node.setAttribute(
                'data-playwright-pointerdown',
                JSON.stringify({
                    clientX: pointerEvent.clientX,
                    clientY: pointerEvent.clientY,
                    pointerType: pointerEvent.pointerType,
                    isPrimary: pointerEvent.isPrimary,
                    button: pointerEvent.button,
                    buttons: pointerEvent.buttons
                })
            )
        })
    })
    await target.evaluate((node) => {
        node.setAttribute('data-playwright-drag-start-count', '0')
        node.addEventListener('svelte-motion:drag-start', () => {
            const count = Number(node.getAttribute('data-playwright-drag-start-count') ?? 0)
            node.setAttribute('data-playwright-drag-start-count', String(count + 1))
        })
    })
}

const readPointerDown = async (handle: Locator): Promise<PointerDownSnapshot> => {
    const value = await handle.getAttribute('data-playwright-pointerdown')
    if (!value) throw new Error('no pointerdown snapshot')
    return JSON.parse(value) as PointerDownSnapshot
}

const waitForAnimationFrames = async (page: Page) => {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            })
    )
}

test.describe('drag/controls', () => {
    test('imperative start moves x only with dragControls', async ({ page }) => {
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        const h = await handle.boundingBox()
        if (!s) throw new Error('no s')
        if (!h) throw new Error('no h')

        // Use Playwright's mouse API for reliable cross-platform behavior
        // Click on handle to initiate drag
        await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
        await page.mouse.down()
        // Move further right to ensure clear movement (snapToCursor centers the 100px element on cursor)
        await page.mouse.move(s.x + 120, s.y + 40, { steps: 5 })
        await page.mouse.up()

        await page.waitForTimeout(100)
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        // With snapToCursor and 100px width, element left edge = cursor - 50 = s.x + 120 - 50 = s.x + 70
        expect(e.x).toBeGreaterThan(s.x + 50)
        expect(Math.abs(e.y - s.y)).toBeLessThan(5)
    })

    test('tiny right nudge does NOT teleport on x-only dragControls', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        await waitForAnimationFrames(page)
        const s = await el.boundingBox()
        const h = await handle.boundingBox()
        if (!s) throw new Error('no s')
        if (!h) throw new Error('no h')

        expect(page.viewportSize()).toEqual({ width: 1280, height: 720 })
        expect(s.x).toBe(590)
        expect(s.y).toBe(235)
        expect(s.width).toBe(100)
        expect(s.height).toBe(100)
        const handleCenter = { x: h.x + h.width / 2, y: h.y + h.height / 2 }
        expect(handleCenter.x).toBe(639.9921875)
        expect(handleCenter.y).toBe(215)
        await installControlObservers(handle, el)

        // Use mouse API for micro nudge
        await page.mouse.move(handleCenter.x, handleCenter.y)
        await page.mouse.down()
        // micro nudge on x (just 2px)
        await page.mouse.move(handleCenter.x + 2, handleCenter.y, { steps: 2 })
        await page.mouse.up()
        await waitForAnimationFrames(page)

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        const tinyPointerDown = await readPointerDown(handle)
        expect(tinyPointerDown).toEqual({
            clientX: handleCenter.x,
            clientY: handleCenter.y,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            buttons: 1
        })
        expect(await el.getAttribute('data-playwright-drag-start-count')).toBe('0')
        expect(e.x - s.x).toBe(-0.0078125)
        expect(e.y - s.y).toBe(0)
        // The threshold-only snap must not jump across the page.
        expect(e.x - s.x).toBeLessThan(40)
        expect(Math.abs(e.y - s.y)).toBeLessThan(2)

        // Cross the 3px threshold separately so this regression still fails if dragging is disabled.
        await page.mouse.move(handleCenter.x, handleCenter.y)
        await page.mouse.down()
        await page.mouse.move(handleCenter.x + 20, handleCenter.y, { steps: 5 })
        await expect(el).toHaveAttribute('data-svelte-motion-drag-active', 'true')
        const active = await el.boundingBox()
        if (!active) throw new Error('no active')
        expect(await el.getAttribute('data-playwright-drag-start-count')).toBe('1')
        expect(active.x - e.x).toBeCloseTo(20, 0)
        expect(Math.abs(active.y - e.y)).toBeLessThan(2)
        await page.mouse.up()
        await expect(el).not.toHaveAttribute('data-svelte-motion-drag-active', 'true')
    })

    test('snapToCursor is consistent with initial coordinates', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls-initial')
        const handle = page.getByTestId('initial-handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        await waitForAnimationFrames(page)

        expect(page.viewportSize()).toEqual({ width: 1280, height: 720 })
        const boot = await el.boundingBox()
        const bootHandle = await handle.boundingBox()
        if (!boot) throw new Error('no boot')
        if (!bootHandle) throw new Error('no boot handle')
        expect(boot).toEqual({ x: 700, y: 477, width: 80, height: 80 })
        expect(bootHandle).toEqual({
            x: 581.609375,
            y: 405,
            width: 116.78125,
            height: 24
        })
        const initialTranslation = await el.evaluate((node) => {
            const transform = new DOMMatrixReadOnly(getComputedStyle(node).transform)
            return { x: transform.m41, y: transform.m42 }
        })
        expect(initialTranslation).toEqual({ x: 100, y: 40 })
        await installControlObservers(handle, el)

        const dragToHandle = async (expectedBefore: { x: number; y: number }) => {
            const before = await el.boundingBox()
            const h = await handle.boundingBox()
            if (!before) throw new Error('no before')
            if (!h) throw new Error('no h')
            expect(before.x).toBeCloseTo(expectedBefore.x, 0)
            expect(before.y).toBeCloseTo(expectedBefore.y, 0)
            expect(h).toEqual(bootHandle)
            const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 }
            expect(start).toEqual({ x: 640, y: 417 })
            await page.mouse.move(start.x, start.y)
            await page.mouse.down()
            expect(await readPointerDown(handle)).toEqual({
                clientX: 640,
                clientY: 417,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: 1
            })
            await page.mouse.move(690, 467, { steps: 5 })
            await page.waitForTimeout(50)
            await expect(el).toHaveAttribute('data-svelte-motion-drag-active', 'true')
            const active = await el.boundingBox()
            await page.mouse.up()
            await page.waitForTimeout(100)
            await expect(el).not.toHaveAttribute('data-svelte-motion-drag-active', 'true')
            if (!active) throw new Error('no active')
            return active
        }

        const first = await dragToHandle({ x: 700, y: 477 })
        const second = await dragToHandle({ x: 650, y: 427 })

        expect(first.x).toBeCloseTo(650, 0)
        expect(first.y).toBeCloseTo(427, 0)
        expect(second.x).toBeCloseTo(600, 0)
        expect(second.y).toBeCloseTo(377, 0)
        expect(second.x - first.x).toBeCloseTo(-50, 0)
        expect(second.y - first.y).toBeCloseTo(-50, 0)
        expect(await el.getAttribute('data-playwright-drag-start-count')).toBe('2')
    })
})
