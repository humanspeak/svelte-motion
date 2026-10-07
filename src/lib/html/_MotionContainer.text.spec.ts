import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ExactText from './__tests__/ExactText.svelte'

const cases = {
    single: 'a',
    adjacent: 'ab',
    graphemes: '👩‍💻 é',
    authored: ' a   b\n',
    value: 'value',
    svg: 'svg',
    void: ''
}

describe('Motion container exact text', () => {
    for (const [testId, expected] of Object.entries(cases)) {
        it(`preserves ${testId} text without generated sibling spaces`, () => {
            const { getByTestId } = render(ExactText)
            expect(getByTestId(testId).textContent).toBe(expected)
        })
    }

    it('preserves text when a MotionValue child updates', async () => {
        const { getByTestId, getByRole } = render(ExactText)
        await fireEvent.click(getByRole('button', { name: 'Update value' }))
        expect(getByTestId('value').textContent).toBe('updated')
    })
})
