import Probe from '$lib/components/__tests__/Probe.svelte'
import ProviderWithProbe from '$lib/components/__tests__/ProviderWithProbe.svelte'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

describe('motionConfig.context', () => {
    it('getMotionConfig returns undefined before provider is set (inside component)', () => {
        // Render only a probe; context has not been provided
        render(Probe)
        const host = screen.getByTestId('probe')
        expect(host.getAttribute('data-probe')).toBe('none')
    })

    it('createMotionConfig sets context and getMotionConfig reads it (via Provider)', () => {
        render(ProviderWithProbe, { props: { transition: { duration: 0.3 } } })
        const host = screen.getByTestId('probe')
        expect(host.getAttribute('data-probe')).toBe('0.3')
    })
})
