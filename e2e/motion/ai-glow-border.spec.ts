import { expect, test } from '@playwright/test'

/**
 * AI glow border (plan 005) — the Apple Intelligence wavy ring rebuilt on
 * MotionValues. The page is the living regression test for plan 002's
 * declarative SVG filter-attribute binding (`motion.feoffset` dx/dy,
 * `motion.fedisplacementmap` attrScale), so these tests read the REAL DOM
 * attributes those bindings write.
 *
 * The maintainer rejected the original prototype for jank, so the frame
 * budget here is a hard gate, not advisory: p95 rAF delta under budget and
 * zero deltas > 100ms after a 500ms warmup. See the environment note on
 * `test.use` below for how the budget differs between GPU and CI runs.
 */

const PAGE = '/tests/ai-glow-border'

/** Idle displacement base is 20, listening 32, each swelling ±~32%. */
const LISTENING_SCALE_FLOOR = 28

/**
 * Two measurement environments, one intent:
 * - Locally (GPU available) we run real Chrome with GPU rasterization and
 *   hold the demo to the hardware gate: p95 < 25ms — the "is it actually
 *   smooth" verification (measured 16.7ms p95, locked 60fps).
 * - CI (blacksmith ubuntu, no GPU, bundled chromium — Chrome Stable is not
 *   installed there) software-rasterizes SVG filters via SwiftShader, so the
 *   same page measures ~3× slower REGARDLESS of real-world smoothness. There
 *   the budget is a regression tripwire against the measured software
 *   baseline — it catches reintroduced jank (document-wide recalcs,
 *   oversized filter regions), not user experience.
 * The anti-throttling flags matter in both: an unfocused automation window
 * otherwise gets rAF throttled to ~3fps.
 */
const IS_CI = !!process.env.CI

test.use({
    ...(IS_CI ? {} : { channel: 'chrome' }),
    launchOptions: {
        args: [
            // GPU flags only where a GPU exists: in headless CI they can
            // stall frame production entirely (observed 0 rAF ticks in 2s).
            ...(IS_CI
                ? []
                : [
                      '--enable-gpu',
                      '--enable-gpu-rasterization',
                      '--ignore-gpu-blocklist',
                      '--use-angle=metal'
                  ]),
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows'
        ]
    }
})

const P95_BUDGET_MS = IS_CI ? 60 : 25

// Perf measurements are contention-sensitive: in a full parallel suite run,
// sibling workers' builds/tests can starve this page's frame loop and blow
// the budget spuriously. Retries absorb that transient noise WITHOUT touching
// the thresholds — a genuine jank regression is persistent and fails all
// three attempts.
test.describe.configure({ retries: 2 })

test.describe('motion/ai-glow-border', () => {
    test('frame budget: p95 < 25ms, no long frames after warmup', async ({ page }) => {
        await page.goto(PAGE)
        await page.locator('[data-testid="card"]').waitFor({ state: 'visible' })

        const { p95, worst, frames } = await page.evaluate(async () => {
            // Warmup: let hydration, font loads and first rasters settle.
            await new Promise((r) => setTimeout(r, 500))

            const deltas: number[] = []
            let last = performance.now()
            await new Promise<void>((resolve) => {
                const start = last
                const tick = (t: number) => {
                    deltas.push(t - last)
                    last = t
                    if (t - start < 2000) requestAnimationFrame(tick)
                    else resolve()
                }
                requestAnimationFrame(tick)
            })
            deltas.shift() // first delta spans the rAF scheduling gap

            const sorted = [...deltas].sort((a, b) => a - b)
            return {
                p95: sorted[Math.floor(sorted.length * 0.95)],
                worst: sorted[sorted.length - 1],
                frames: deltas.length
            }
        })

        expect(frames, 'sampled a real 2s window').toBeGreaterThan(30)
        expect(p95, `p95 frame delta ${p95.toFixed(1)}ms`).toBeLessThan(P95_BUDGET_MS)
        expect(worst, `worst frame delta ${worst.toFixed(1)}ms`).toBeLessThan(100)
    })

    test('filter channels are MotionValue-driven, never [object Object]', async ({ page }) => {
        await page.goto(PAGE)
        const offsets = page.locator('#aiWave feOffset')
        const dispMap = page.locator('[data-testid="displacement-map"]')

        // Both noise fields drift on live 2D vectors.
        const grab = () =>
            page.evaluate(() => {
                const off = document.querySelectorAll('#aiWave feOffset')
                return Array.from(off).map((el) => ({
                    dx: el.getAttribute('dx') ?? '',
                    dy: el.getAttribute('dy') ?? ''
                }))
            })

        const before = await grab()
        await expect
            .poll(
                async () => {
                    const now = await grab()
                    return now.every((o, i) => o.dx !== before[i].dx && o.dy !== before[i].dy)
                },
                { timeout: 8000, message: 'feOffset dx/dy never advanced' }
            )
            .toBe(true)

        // The bound attributes render as numbers, not stringified objects.
        for (const el of [offsets.first(), offsets.nth(1), dispMap]) {
            for (const attr of ['dx', 'dy', 'scale']) {
                const value = await el.getAttribute(attr)
                if (value !== null) {
                    expect(value, `${attr} must be numeric`).not.toContain('object')
                    expect(Number.isFinite(Number(value)), `${attr}=${value}`).toBe(true)
                }
            }
        }
    })

    test('listening toggle boosts displacement and flips state', async ({ page }) => {
        await page.goto(PAGE)
        const card = page.locator('[data-testid="card"]')
        const chip = page.locator('[data-testid="state-chip"]')
        const dispMap = page.locator('[data-testid="displacement-map"]')

        await expect(card).toHaveAttribute('aria-pressed', 'false')
        await expect(chip).toHaveText(/idle/i)

        // force: the listening pulse keeps the card in constant sub-pixel
        // motion, so Playwright's stability wait would never settle.
        await card.click({ force: true })

        await expect(card).toHaveAttribute('aria-pressed', 'true')
        await expect(chip).toHaveText(/listening/i)

        // The scale spring rises past the idle swell's ceiling (~26) toward
        // the listening base (32).
        await expect
            .poll(async () => Number(await dispMap.getAttribute('scale')), {
                timeout: 4000,
                message: 'displacement scale never rose to the listening range'
            })
            .toBeGreaterThan(LISTENING_SCALE_FLOOR)

        // And back.
        await card.click({ force: true })
        await expect(card).toHaveAttribute('aria-pressed', 'false')
        await expect(chip).toHaveText(/idle/i)
    })

    test('reduced motion renders a static glow', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(PAGE)
        await page.locator('[data-testid="card"]').waitFor({ state: 'visible' })
        await page.waitForTimeout(300) // past mount effects

        const sample = () =>
            page.evaluate(() => {
                const rotor = document.querySelector('[data-testid="rotor"]') as Element
                const offset = document.querySelector('#aiWave feOffset') as Element
                return {
                    rotor: getComputedStyle(rotor).transform,
                    dy: offset.getAttribute('dy')
                }
            })

        const a = await sample()
        await page.waitForTimeout(500)
        const b = await sample()

        expect(b.rotor, 'conic rotor must not rotate').toBe(a.rotor)
        expect(b.dy, 'noise must not scroll').toBe(a.dy)
    })

    test('thickness slider scales the rings in proportion', async ({ page }) => {
        await page.goto(PAGE)
        const slider = page.locator('[data-testid="thickness-slider"]')
        await slider.waitFor({ state: 'visible' })

        const measure = () =>
            page.evaluate(() => {
                const base = document.querySelector('.ring.base') as Element
                const cs = getComputedStyle(base)
                return {
                    inset: cs.top,
                    blur: /blur\(([^)]+)\)/.exec(cs.filter)?.[1] ?? ''
                }
            })

        await slider.fill('8')
        await expect.poll(async () => (await measure()).inset).toBe('-8px')
        expect((await measure()).blur).toBe('6.4px') // 0.8 × t

        await slider.fill('2')
        await expect.poll(async () => (await measure()).inset).toBe('-2px')
    })
})
