import type { Page } from '@playwright/test'

/**
 * Painted-frame recording for crossfade and follow checks (plan 012).
 *
 * Two independent sources, both started before `action` runs:
 *
 * - a CDP screencast (`everyNthFrame: 1`, PNG), sorted by the compositor's
 *   `metadata.timestamp` as in `e2e/independent-transforms/speed-change.spec.ts`;
 * - an in-page `requestAnimationFrame` loop that, on every frame, hit-tests
 *   each probe with `document.elementFromPoint` and reads the rects of the
 *   requested selectors (plan 015a amendment A1: the screencast drops frames,
 *   the rAF loop does not).
 *
 * All times are epoch milliseconds, relative to the moment `action` was
 * called (`0`), so screencast frames and rAF hits share one clock.
 */

/**
 * A probe point in viewport CSS px, or a selector whose rect centre is probed
 * (resolved again on every frame).
 */
export type Probe = { x: number; y: number } | { selector: string }

/** One decoded-later screencast frame. */
export interface PaintedFrame {
    /** Capture time, ms since the action started. */
    t: number
    /** Base64 PNG. */
    data: string
    /** The viewport width in CSS px the frame was captured at. */
    deviceWidth: number
}

/** A box read in a rAF frame. */
export interface HitRect {
    left: number
    top: number
    width: number
    height: number
}

/** One rAF frame's probe results. */
export interface HitFrame {
    /** ms since the action started. */
    t: number
    /**
     * Per probe, the `id` of the closest element with one at the point, or
     * `''` when only elements without an id (or the background) were hit.
     */
    hits: string[]
    /** Per requested selector, its first match's rect, or `null`. */
    rects: (HitRect | null)[]
    /** Per requested selector, how many elements match. */
    counts: number[]
    /**
     * Per requested selector, whether its first match is shown: computed
     * `visibility` isn't `hidden` and computed `opacity` is above 0.01.
     */
    visible: boolean[]
    /** Per requested selector, its first match's computed `opacity`, or `null`. */
    opacities: (number | null)[]
}

/** What {@link recordPainted} returns. */
export interface PaintedRecording {
    frames: PaintedFrame[]
    hits: HitFrame[]
}

type ScreencastFrame = { data: string; metadata: { deviceWidth: number; timestamp?: number } }

/**
 * Run `action` under a CDP screencast plus a per-rAF hit-test loop.
 *
 * @param page The page to record.
 * @param action What to do once recording has started (e.g. a click).
 * @param ms How long to keep recording after `action` resolves.
 * @param probes Points hit-tested on every rAF.
 * @param selectors Elements whose rect and match count are read on every rAF.
 * @returns Every screencast frame and every rAF frame, from the action on.
 * @example
 * ```ts
 * const { frames, hits } = await recordPainted(page, () => page.click('#shape-0'), 600, [
 *     { selector: '#shape-0' }
 * ])
 * ```
 */
export async function recordPainted(
    page: Page,
    action: () => Promise<unknown>,
    ms: number,
    probes: Probe[] = [],
    selectors: string[] = []
): Promise<PaintedRecording> {
    const cdp = await page.context().newCDPSession(page)
    const shots: ScreencastFrame[] = []
    cdp.on('Page.screencastFrame', (event) => {
        shots.push({ data: event.data, metadata: event.metadata })
        void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
    })
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 }
    await cdp.send('Page.startScreencast', {
        format: 'png',
        everyNthFrame: 1,
        maxWidth: viewport.width,
        maxHeight: viewport.height
    })
    await page.evaluate(
        ({ probes, selectors }) => {
            type W = Window & { __painted?: { stop: boolean; hits: unknown[] } }
            const w = window as W
            const state = { stop: false, hits: [] as unknown[] }
            w.__painted = state
            const idOf = (element: Element | null) => element?.closest('[id]')?.id ?? ''
            // A selector probe is resolved every frame, at its element's
            // current (painted) centre; a missing element hits nothing.
            const pointOf = (probe: (typeof probes)[number]) => {
                if ('x' in probe) return probe
                const element = document.querySelector(probe.selector)
                if (!element) return null
                const rect = element.getBoundingClientRect()
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            }
            const tick = () => {
                if (state.stop) return
                state.hits.push({
                    t: performance.timeOrigin + performance.now(),
                    hits: probes.map((probe) => {
                        const point = pointOf(probe)
                        return point ? idOf(document.elementFromPoint(point.x, point.y)) : ''
                    }),
                    rects: selectors.map((selector) => {
                        const element = document.querySelector(selector)
                        if (!element) return null
                        const { left, top, width, height } = element.getBoundingClientRect()
                        return { left, top, width, height }
                    }),
                    counts: selectors.map((selector) => document.querySelectorAll(selector).length),
                    visible: selectors.map((selector) => {
                        const element = document.querySelector(selector)
                        if (!element) return false
                        const style = getComputedStyle(element)
                        return style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.01
                    }),
                    opacities: selectors.map((selector) => {
                        const element = document.querySelector(selector)
                        return element ? parseFloat(getComputedStyle(element).opacity) : null
                    })
                })
                requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        },
        { probes, selectors }
    )
    const start = await page.evaluate(() => performance.timeOrigin + performance.now())
    await action()
    await page.waitForTimeout(ms)
    const raw = await page.evaluate(() => {
        type W = Window & { __painted?: { stop: boolean; hits: unknown[] } }
        const state = (window as W).__painted!
        state.stop = true
        return state.hits as HitFrame[]
    })
    await cdp.send('Page.stopScreencast')
    await cdp.detach()
    shots.sort((a, b) => (a.metadata.timestamp ?? 0) - (b.metadata.timestamp ?? 0))
    return {
        frames: shots
            .map((shot) => ({
                t: (shot.metadata.timestamp ?? 0) * 1000 - start,
                data: shot.data,
                deviceWidth: shot.metadata.deviceWidth
            }))
            .filter((frame) => frame.t >= 0),
        hits: raw.map((hit) => ({ ...hit, t: hit.t - start })).filter((hit) => hit.t >= 0)
    }
}

/** An RGB triple. */
export type Rgb = [number, number, number]

/**
 * Read the pixel colour at each point, in every frame.
 *
 * @param page Any page (used only to decode the PNGs).
 * @param frames Frames from {@link recordPainted}.
 * @param points Viewport CSS px.
 * @returns Per frame, per point, its RGB.
 */
export async function pixelsAt(
    page: Page,
    frames: PaintedFrame[],
    points: { x: number; y: number }[]
): Promise<Rgb[][]> {
    return page.evaluate(
        async ({ frames, points }) => {
            const out: [number, number, number][][] = []
            for (const { data, deviceWidth } of frames) {
                const blob = await (await fetch('data:image/png;base64,' + data)).blob()
                const bitmap = await createImageBitmap(blob)
                const canvas = document.createElement('canvas')
                canvas.width = bitmap.width
                canvas.height = bitmap.height
                const context = canvas.getContext('2d')!
                context.drawImage(bitmap, 0, 0)
                const scale = bitmap.width / deviceWidth
                out.push(
                    points.map(({ x, y }) => {
                        const p = context.getImageData(
                            Math.min(bitmap.width - 1, Math.round(x * scale)),
                            Math.min(bitmap.height - 1, Math.round(y * scale)),
                            1,
                            1
                        ).data
                        return [p[0], p[1], p[2]] as [number, number, number]
                    })
                )
            }
            return out
        },
        { frames, points }
    )
}

/**
 * Count the connected regions of non-background pixels inside a viewport
 * rect, per frame (4-connected, on a 2 CSS px grid). A pixel is background
 * when every channel is within `tolerance` of `background`.
 *
 * @param page Any page (used only to decode the PNGs).
 * @param frames Frames from {@link recordPainted}.
 * @param rect The viewport rect to scan, in CSS px.
 * @param background The background colour.
 * @param tolerance Per-channel tolerance for the background.
 * @param minArea Regions smaller than this many grid cells are ignored (antialiasing).
 * @returns Per frame, the regions found: their cell count and bounding box in CSS px.
 */
export async function regionsIn(
    page: Page,
    frames: PaintedFrame[],
    rect: HitRect,
    background: Rgb,
    tolerance = 12,
    minArea = 8
): Promise<{ area: number; left: number; top: number; right: number; bottom: number }[][]> {
    return page.evaluate(
        async ({ frames, rect, background, tolerance, minArea }) => {
            const step = 2
            const out: {
                area: number
                left: number
                top: number
                right: number
                bottom: number
            }[][] = []
            for (const { data, deviceWidth } of frames) {
                const blob = await (await fetch('data:image/png;base64,' + data)).blob()
                const bitmap = await createImageBitmap(blob)
                const canvas = document.createElement('canvas')
                canvas.width = bitmap.width
                canvas.height = bitmap.height
                const context = canvas.getContext('2d')!
                context.drawImage(bitmap, 0, 0)
                const scale = bitmap.width / deviceWidth
                const cols = Math.floor(rect.width / step)
                const rows = Math.floor(rect.height / step)
                const image = context.getImageData(0, 0, bitmap.width, bitmap.height).data
                const filled = new Uint8Array(cols * rows)
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const x = Math.min(
                            bitmap.width - 1,
                            Math.round((rect.left + c * step) * scale)
                        )
                        const y = Math.min(
                            bitmap.height - 1,
                            Math.round((rect.top + r * step) * scale)
                        )
                        const i = (y * bitmap.width + x) * 4
                        const bg =
                            Math.abs(image[i] - background[0]) <= tolerance &&
                            Math.abs(image[i + 1] - background[1]) <= tolerance &&
                            Math.abs(image[i + 2] - background[2]) <= tolerance
                        filled[r * cols + c] = bg ? 0 : 1
                    }
                }
                const seen = new Uint8Array(cols * rows)
                const regions: {
                    area: number
                    left: number
                    top: number
                    right: number
                    bottom: number
                }[] = []
                for (let start = 0; start < filled.length; start++) {
                    if (!filled[start] || seen[start]) continue
                    const stack = [start]
                    seen[start] = 1
                    let area = 0
                    let minC = cols
                    let minR = rows
                    let maxC = 0
                    let maxR = 0
                    while (stack.length) {
                        const cell = stack.pop()!
                        area++
                        const r = Math.floor(cell / cols)
                        const c = cell % cols
                        minC = Math.min(minC, c)
                        maxC = Math.max(maxC, c)
                        minR = Math.min(minR, r)
                        maxR = Math.max(maxR, r)
                        const next = [
                            c > 0 ? cell - 1 : -1,
                            c < cols - 1 ? cell + 1 : -1,
                            r > 0 ? cell - cols : -1,
                            r < rows - 1 ? cell + cols : -1
                        ]
                        for (const n of next) {
                            if (n >= 0 && filled[n] && !seen[n]) {
                                seen[n] = 1
                                stack.push(n)
                            }
                        }
                    }
                    if (area >= minArea) {
                        regions.push({
                            area,
                            left: rect.left + minC * step,
                            top: rect.top + minR * step,
                            right: rect.left + maxC * step,
                            bottom: rect.top + maxR * step
                        })
                    }
                }
                out.push(regions)
            }
            return out
        },
        { frames, rect, background, tolerance, minArea }
    )
}
