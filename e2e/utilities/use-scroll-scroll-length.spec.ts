import { expect, test } from '@playwright/test'

// useScroll scrollXLength / scrollYLength (Motion 14.7.1, `623a0e7b6`, #2189).
const URL = '/tests/use-scroll/scroll-length?@isPlaywright=true'

test.describe('useScroll scrollXLength / scrollYLength', () => {
    test('reports each axis maximum offset, the distance from the end, and resizes', async ({
        page
    }) => {
        await page.goto(URL)

        // 1000×1500 content in a 400×300 box.
        await expect(page.getByTestId('scroll-x-length')).toHaveText('600')
        await expect(page.getByTestId('scroll-y-length')).toHaveText('1200')

        await page.getByTestId('container').evaluate((el) => {
            el.scrollTop = 500
            el.scrollLeft = 100
        })
        await expect(page.getByTestId('scroll-y')).toHaveText('500')
        await expect(page.getByTestId('remaining-y')).toHaveText('700')
        await expect(page.getByTestId('scroll-x')).toHaveText('100')

        // Box grows to 500px tall: max offset 1500 - 500.
        await page.getByTestId('grow').click()
        await expect(page.getByTestId('scroll-y-length')).toHaveText('1000')
    })
})
