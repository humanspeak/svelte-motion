import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import MotionConfigWithProbe from './__tests__/MotionConfigWithProbe.svelte'

describe('MotionConfig.svelte', () => {
    it('provides transition to children via context', async () => {
        render(MotionConfigWithProbe, { props: { transition: { duration: 0.5 } } })
        const host = await screen.findByTestId('probe')
        expect(host.getAttribute('data-probe')).toBe('0.5')
    })
})
