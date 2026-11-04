import { expect, test } from '@playwright/test'

/**
 * Plan 012 A6: an unrelated reflow mid a plain `layout` animation (no
 * `layoutId`). Upstream re-renders the box, and its `willUpdate()` snapshot
 * measures where the box is painted (`updateSnapshot` → `measure`,
 * create-projection-node.ts 967-979, 1080-1101 @ v14.7.1), so the slide
 * carries on from there. Ours commits the reflow through the box's
 * ResizeObserver (`commitObservedLayoutChange`).
 *
 * Against `src/routes/tests/layout/reflow-mid-animation/+page.svelte`, which
 * records `[ms, left, top, height]` once per painted frame. The same page in
 * framer-motion 14.7.1 (React 18, StrictMode) slides on from the painted box:
 * 156px at the last frame before the reflow, then 158, 162, 166 … to 400px,
 * never stepping more than 7.2px.
 */
type Sample = [number, number, number, number]
type ReflowWindow = Window & { run: () => Promise<Sample[]> }

test.use({ viewport: { width: 1280, height: 720 } })

test('a reflow mid a layout animation keeps sliding from the painted box', async ({ page }) => {
    await page.goto('/tests/layout/reflow-mid-animation?@isPlaywright=true')
    await expect(page.locator('#box')).toBeVisible()

    const samples = await page.evaluate(() => (window as unknown as ReflowWindow).run())
    const startLeft = samples[0][1]
    const offset = ([, left]: Sample) => Math.round((left - startLeft) * 10) / 10
    // The page grows the content 400ms after the click.
    const reflowIndex = samples.findIndex(([ms]) => ms >= 400)
    const trace = samples.map((s, i) => `${i}:${Math.round(s[0])}ms ${offset(s)}px h${s[3]}`)
    console.log(`[reflow-mid-animation] reflow at frame ${reflowIndex}\n${trace.join('\n')}`)

    // Control: the reflow lands mid slide, and the content does grow.
    expect(reflowIndex).toBeGreaterThan(0)
    const atReflow = offset(samples[reflowIndex - 1])
    expect(atReflow).toBeGreaterThan(50)
    expect(atReflow).toBeLessThan(350)
    expect(samples[samples.length - 1][3]).toBeCloseTo(60, 0)
    // …and the slide still ends at the new slot (the first sample can be
    // painted a frame into the slide).
    expect(Math.abs(offset(samples[samples.length - 1]) - 400)).toBeLessThan(2)

    // No painted frame jumps: a linear 400px/s slide steps ~7px per frame.
    for (let i = 1; i < samples.length; i++) {
        const step = Math.abs(samples[i][1] - samples[i - 1][1])
        expect(step, `frame ${i - 1} → ${i}: ${trace[i - 1]} → ${trace[i]}`).toBeLessThan(20)
    }
})
