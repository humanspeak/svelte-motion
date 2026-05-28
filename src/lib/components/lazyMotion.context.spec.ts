import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import LazyMotionContextProbe from './__tests__/LazyMotionContextProbe.svelte'

describe('lazyMotion.context', () => {
    it('sets and reads the LazyMotion context', () => {
        render(LazyMotionContextProbe)

        const probe = screen.getByTestId('lazy-context')
        expect(probe.getAttribute('data-returned-same')).toBe('true')
        expect(probe.getAttribute('data-read-same')).toBe('true')
        expect(probe.getAttribute('data-strict')).toBe('true')
        expect(probe.getAttribute('data-gestures')).toBe('true')
        expect(probe.getAttribute('data-loaded')).toBe('true')
    })
})
