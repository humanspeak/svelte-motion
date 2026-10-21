import { expect, test } from '@playwright/test'

/**
 * Spike 006 acceptance test: drag elements get upstream's default drag styles.
 *
 * framer-motion v14.5.0 `render/html/use-props.ts:59-73`: when `drag` is set and
 * `dragListener !== false`, the element gets `draggable={false}`,
 * `user-select: none`, `-webkit-touch-callout: none`, and a `touch-action` that
 * disables scrolling on the dragged axis.
 */

const readDragStyles = (el: Element) => {
    const cs = getComputedStyle(el)
    return {
        touchAction: cs.touchAction,
        userSelect: cs.userSelect || cs.getPropertyValue('-webkit-user-select'),
        draggable: el.getAttribute('draggable')
    }
}

for (const [path, testId, touchAction] of [
    ['/tests/drag/basic', 'drag-box', 'none'],
    ['/tests/drag/axis-x', 'drag-x', 'pan-y'],
    ['/tests/drag/axis-y', 'drag-y', 'pan-x']
] as const) {
    test(`drag/default-styles: ${path} gets touch-action ${touchAction}, user-select none, draggable=false`, async ({
        page
    }) => {
        await page.goto(`${path}?@isPlaywright=true`)
        const el = page.getByTestId(testId)
        await el.waitFor({ state: 'visible' })
        const styles = await el.evaluate(readDragStyles)
        expect(styles.touchAction).toBe(touchAction)
        expect(styles.userSelect).toBe('none')
        expect(styles.draggable).toBe('false')
    })
}
