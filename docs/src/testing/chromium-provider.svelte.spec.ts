import { expect, it } from 'vitest'
import { page } from 'vitest/browser'

it('starts the configured Chromium and drives a click', async () => {
    const button = document.createElement('button')
    button.textContent = 'Idle'
    button.addEventListener('click', () => {
        button.textContent = 'Clicked'
    })
    document.body.appendChild(button)

    try {
        await page.getByRole('button', { name: 'Idle' }).click()

        expect(button.textContent).toBe('Clicked')
    } finally {
        button.remove()
    }
})
