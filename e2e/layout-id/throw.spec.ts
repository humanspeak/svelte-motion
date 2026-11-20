import { expect, test, type Page } from '@playwright/test'

/**
 * A card thrown with drag hands its velocity to the `layoutId` element that
 * replaces it, when the transition is a spring. Tweens take no velocity.
 *
 * Port of the three drag tests of upstream
 * `packages/framer-motion/cypress/integration/layout-velocity.ts` @ `v14.14.0`
 * (Motion 14.13, PR #4047), with their names, waits and thresholds, against
 * `src/routes/tests/layout-id/throw` (a port of
 * `dev/react/src/tests/layout-velocity-drag-layout-id.tsx` and, with
 * `?resize`, `layout-velocity-throw-resize.tsx`). The other twelve tests are in
 * `e2e/layout/velocity.spec.ts`.
 *
 * The pointer events are upstream's synthetic ones, dispatched from inside the
 * page, one move per animation frame.
 */

test.use({ viewport: { width: 1280, height: 720 } })

const url = (query: string) => `/tests/layout-id/throw?${query}@isPlaywright=true`

/** Installs upstream's `dispatchPointer` and `afterFrame` helpers on `window`. */
const installHelpers = (page: Page) =>
    page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>
        w.dispatchPointer = (type: string, x: number, y: number) => {
            const target = type === 'pointerdown' ? document.getElementById('box')! : window
            target.dispatchEvent(
                new PointerEvent(type, {
                    clientX: x,
                    clientY: y,
                    pointerId: 1,
                    pointerType: 'mouse',
                    isPrimary: true,
                    button: 0,
                    buttons: type === 'pointerup' ? 0 : 1,
                    bubbles: true,
                    cancelable: true
                })
            )
        }
        w.afterFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })

type ThrowWindow = Window & {
    dispatchPointer: (type: string, x: number, y: number) => void
    afterFrame: () => Promise<void>
}

/**
 * Visits the page, waits two frames, then presses on the card at (350, 150)
 * and moves it 10px. Waits 50ms after the next frame, as upstream does.
 */
const startDrag = async (page: Page, query: string) => {
    await page.goto(url(query))
    await page.waitForTimeout(200)
    await installHelpers(page)
    await page.evaluate(async () => {
        const w = window as unknown as ThrowWindow
        await w.afterFrame()
        await w.afterFrame()
        w.dispatchPointer('pointerdown', 350, 150)
        w.dispatchPointer('pointermove', 360, 150)
        await w.afterFrame()
    })
    await page.waitForTimeout(50)
}

/**
 * Drag the card right with a fast flick. Release swaps it for a detail view
 * with the same layoutId, down and to the left. Returns the card's left edge
 * where the DOM had it when it was removed, and the detail view's first
 * frames.
 */
const throwCard = async (page: Page, query: string) => {
    await startDrag(page, query)
    return page.evaluate(async () => {
        const w = window as unknown as ThrowWindow
        const leftOfBox = () => document.getElementById('box')!.getBoundingClientRect().left
        // `atSwap` is the card where the DOM has it when it is removed, which
        // is what upstream's departing-lead snapshot (`willUpdate()`) reads.
        //
        // Svelte deviation: drag inertia writes one more `x` step in the frame
        // after the release, and Svelte swaps in the detail view in that same
        // frame, before paint, so that step is never painted and no rAF
        // sample sees the card there. React renders the swap in a later task,
        // so upstream's last sample of the card is that position. Reading the
        // removed card's own `translateX` gives the same value here: 300 is
        // its undragged `left`.
        const card = document.getElementById('box')!
        const removed = new Promise<number>((resolve) => {
            const observer = new MutationObserver(() => {
                if (card.isConnected) return
                observer.disconnect()
                const tx = /translateX\((-?[\d.]+)px\)/.exec(card.style.transform)
                resolve(300 + (tx ? Number(tx[1]) : 0))
            })
            observer.observe(card.parentElement!, { childList: true, subtree: true })
        })
        for (const x of [380, 400, 420, 440]) {
            w.dispatchPointer('pointermove', x, 150)
            await w.afterFrame()
        }
        w.dispatchPointer('pointerup', 440, 150)
        // Sample the detail view's first frames.
        const samples = await new Promise<number[]>((resolve) => {
            const samples: number[] = []
            const tick = () => {
                const box = document.getElementById('box')!
                if (box.style.backgroundColor === 'blue') samples.push(leftOfBox())
                if (samples.length < 6) requestAnimationFrame(tick)
                else resolve(samples)
            }
            requestAnimationFrame(tick)
        })
        return { atSwap: await removed, samples }
    })
}

test.describe('Layout velocity', () => {
    test('A thrown card hands its velocity to a layoutId element', async ({ page }) => {
        const { atSwap, samples } = await throwCard(page, '')
        // The detail view is to the left, but the first frames follow the
        // throw to the right.
        expect(Math.max(...samples.slice(0, 3))).toBeGreaterThan(atSwap + 4)
    })

    test('A layoutId tween starts from rest', async ({ page }) => {
        const { atSwap, samples } = await throwCard(page, 'tween&')
        expect(Math.max(...samples)).toBeLessThan(atSwap + 1)
    })

    // Not upstream: our own red-first check for plan 004 (motion-14-14-0). The
    // detail view's first frame is where the card was released, give or take
    // one frame of throw travel, not back at the card's undragged place. The
    // tween variant takes no velocity, so it checks the start box alone.
    for (const [variant, query] of [
        ['spring', ''],
        ['tween', 'tween&']
    ] as const) {
        test(`the detail view starts where the card was released (${variant})`, async ({
            page
        }) => {
            const { atSwap, samples } = await throwCard(page, query)
            expect(Math.abs(samples[0] - atSwap)).toBeLessThan(20)
        })
    }

    test('A thrown card keeps its size between the card and the detail view', async ({ page }) => {
        await startDrag(page, 'resize&')
        const widths = await page.evaluate(async () => {
            const w = window as unknown as ThrowWindow
            for (const x of [400, 440, 480, 520]) {
                w.dispatchPointer('pointermove', x, 150)
                await w.afterFrame()
            }
            w.dispatchPointer('pointerup', 520, 150)
            const widths: number[] = []
            for (let i = 0; i < 40; i++) {
                await w.afterFrame()
                const box = document.getElementById('box')!
                if (box.style.backgroundColor === 'blue') {
                    widths.push(box.getBoundingClientRect().width)
                }
            }
            return widths
        })
        // The throw moves the edges together, so the width only travels from
        // the card's 100px to the detail's 400px.
        expect(widths.length).toBeGreaterThan(10)
        expect(Math.min(...widths)).toBeGreaterThan(99)
        expect(Math.max(...widths)).toBeLessThan(401)
    })
})
