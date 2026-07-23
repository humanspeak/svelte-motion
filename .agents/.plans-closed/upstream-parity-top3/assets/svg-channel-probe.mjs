/**
 * Plan 002 evidence — which SVG keys does `svgEffect` write as attributes,
 * and which as CSS properties?
 *
 * Upstream `motion-dom/src/effects/svg/index.ts` (`addSVGValue`) picks the
 * channel at runtime:
 *
 *     if (key.startsWith('path'))  -> addSVGPathValue
 *     else if (key.startsWith('attr')) -> addAttrValue(convertAttrKey(key))
 *     const handler = key in element.style ? addStyleValue : addAttrValue
 *
 * So the split depends on `key in element.style` **in the target browser**, not
 * on anything in this repo. This probe answers that question against the same
 * Chromium the e2e suite drives, and is the basis for the 2026-07-09 amendment
 * to `002-svg-motionvalue-attributes.md` (see the guard log).
 *
 * Run from the repo root:
 *     node .agents/.plans/upstream-parity-top3/assets/svg-channel-probe.mjs
 *
 * Expected: cx/cy/r/rx/ry/x/y/width/height/d and the stroke-*, *Opacity,
 * stopColor, offset families are CSS properties (style-routed). Only
 * points/viewBox/x1/y1/x2/y2 -- plus the attrX/attrY/attrScale prefix family --
 * reach setAttribute. Re-run this if a Chromium bump is suspected of moving a
 * key from one channel to the other.
 */
import { chromium } from '@playwright/test'

/** Keys to classify, in the order they appear in SVG_ATTRIBUTE_PROPERTIES. */
const KEYS = [
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x',
    'y',
    'width',
    'height',
    'd',
    'points',
    'viewBox',
    'x1',
    'y1',
    'x2',
    'y2',
    'strokeDashoffset',
    'strokeWidth',
    'stopColor',
    'stopOpacity',
    'fillOpacity',
    'strokeOpacity',
    'offset',
    'stroke-width',
    'stroke-dashoffset'
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent('<svg><circle id="c" cx="5" cy="5" r="3"/></svg>')

const result = await page.evaluate((keys) => {
    const circle = document.getElementById('c')
    const inStyle = Object.fromEntries(keys.map((key) => [key, key in circle.style]))

    // Computed styles carry units -- this is why the e2e specs must parseFloat.
    circle.style.strokeDashoffset = 12.5
    const computedDashoffset = getComputedStyle(circle).strokeDashoffset

    // A style-routed write never touches the attribute: polling getAttribute('cx')
    // for a change will hang until the test times out.
    circle.style.cx = '40px'

    return {
        inStyle,
        computedDashoffset,
        cxAttributeAfterStyleWrite: circle.getAttribute('cx'),
        cxComputedAfterStyleWrite: getComputedStyle(circle).cx
    }
}, KEYS)

const styleRouted = KEYS.filter((key) => result.inStyle[key])
const attrRouted = KEYS.filter((key) => !result.inStyle[key])

console.log(`chromium ${browser.version()}\n`)
console.log(`style-routed (addStyleValue): ${styleRouted.join(' ')}`)
console.log(`attr-routed  (addAttrValue) : ${attrRouted.join(' ')}\n`)
console.log(`element.style.strokeDashoffset = 12.5 -> computed ${result.computedDashoffset}`)
console.log(
    `  Number(${JSON.stringify(result.computedDashoffset)}) === ${Number(result.computedDashoffset)}`
)
console.log(
    `element.style.cx = '40px' -> getAttribute('cx') = ${JSON.stringify(result.cxAttributeAfterStyleWrite)}`
)
console.log(
    `                          -> computed cx        = ${JSON.stringify(result.cxComputedAfterStyleWrite)}`
)

await browser.close()
