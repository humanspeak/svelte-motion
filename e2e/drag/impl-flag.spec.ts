import { expect, test } from '@playwright/test'

// SPIKE 006 only: records which drag implementation the build under test uses.
test('drag/impl-flag: build reports its drag implementation', async ({ page }) => {
    await page.goto('/tests/drag/impl-flag')
    const impl = await page.getByTestId('drag-impl').textContent()
    test.info().annotations.push({ type: 'drag-impl', description: String(impl) })
    console.log(`DRAG_IMPL=${impl}`)
    expect(impl).toBe(process.env.VITE_UPSTREAM_DRAG === '1' ? 'upstream' : 'legacy')
})
