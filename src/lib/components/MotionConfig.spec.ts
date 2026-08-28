import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import MotionConfigWithProbe from './__tests__/MotionConfigWithProbe.svelte'
import NestedMotionConfigProbe from './__tests__/NestedMotionConfigProbe.svelte'

describe('MotionConfig.svelte', () => {
    it('provides transition to children via context', async () => {
        render(MotionConfigWithProbe, { props: { transition: { duration: 0.5 } } })
        const host = await screen.findByTestId('probe')
        expect(host.getAttribute('data-probe')).toBe('0.5')
    })

    it('nested configs inherit outer props they do not override', async () => {
        render(NestedMotionConfigProbe)
        const inner = await screen.findByTestId('inner-probe')
        // Inner overrides duration…
        expect(inner.getAttribute('data-duration')).toBe('0.2')
        // …and inherits everything it did not set.
        expect(inner.getAttribute('data-reduced')).toBe('always')
        expect(inner.getAttribute('data-skip')).toBe('true')
    })
})
