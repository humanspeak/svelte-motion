import LayoutGroupProbeHarness from '$lib/components/__tests__/LayoutGroupProbeHarness.svelte'
import { chainLayoutGroupId, scopeLayoutId } from '$lib/components/layoutGroup.context'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

describe('layoutGroup.context — pure helpers', () => {
    describe('chainLayoutGroupId', () => {
        it('returns own id when parent is undefined', () => {
            expect(chainLayoutGroupId(undefined, 'tabs')).toBe('tabs')
        })

        it('returns parent id when own is undefined', () => {
            expect(chainLayoutGroupId('outer', undefined)).toBe('outer')
        })

        it('returns undefined when both are undefined', () => {
            expect(chainLayoutGroupId(undefined, undefined)).toBeUndefined()
        })

        it('joins parent and own with a hyphen (matches framer-motion)', () => {
            expect(chainLayoutGroupId('outer', 'inner')).toBe('outer-inner')
        })
    })

    describe('scopeLayoutId', () => {
        it('passes layoutId through unchanged when no group is in scope', () => {
            expect(scopeLayoutId(undefined, 'hero')).toBe('hero')
        })

        it('prefixes layoutId with the group id and a separator', () => {
            expect(scopeLayoutId('tabs-a', 'underline')).toBe('tabs-a::underline')
        })

        it('keeps sibling groups disjoint', () => {
            // Two sibling groups containing identical layoutId values must
            // produce distinct registry keys, otherwise they cross-animate.
            const left = scopeLayoutId('group-a', 'thumb')
            const right = scopeLayoutId('group-b', 'thumb')
            expect(left).not.toBe(right)
        })

        it('chained group ids produce distinct keys from flat ones', () => {
            // outer + inner=undefined chains to "outer"; outer + inner="x" → "outer-x".
            const flat = scopeLayoutId(chainLayoutGroupId('outer', undefined), 'thumb')
            const nested = scopeLayoutId(chainLayoutGroupId('outer', 'x'), 'thumb')
            expect(flat).toBe('outer::thumb')
            expect(nested).toBe('outer-x::thumb')
        })
    })
})

describe('layoutGroup.context — Svelte context', () => {
    it('getLayoutGroupContext returns undefined outside <LayoutGroup>', () => {
        render(LayoutGroupProbeHarness)
        const probe = screen.getByTestId('layout-group-probe')
        expect(probe.getAttribute('data-id')).toBe('none')
    })

    it('publishes the LayoutGroup id to descendants', () => {
        render(LayoutGroupProbeHarness, { props: { outer: 'tabs' } })
        const probe = screen.getByTestId('layout-group-probe')
        expect(probe.getAttribute('data-id')).toBe('tabs')
    })

    it('nested <LayoutGroup> with default inherit chains "parent-own"', () => {
        render(LayoutGroupProbeHarness, {
            props: { outer: 'outer', inner: 'inner' }
        })
        const probe = screen.getByTestId('layout-group-probe')
        expect(probe.getAttribute('data-id')).toBe('outer-inner')
    })

    it('nested <LayoutGroup inherit={false}> ignores the surrounding scope', () => {
        render(LayoutGroupProbeHarness, {
            props: { outer: 'outer', inner: 'standalone', inherit: false }
        })
        const probe = screen.getByTestId('layout-group-probe')
        expect(probe.getAttribute('data-id')).toBe('standalone')
    })
})
