import LayoutGroupProbeHarness from '$lib/components/__tests__/LayoutGroupProbeHarness.svelte'
import NestedLayoutGroupProbeHarness from '$lib/components/__tests__/NestedLayoutGroupProbeHarness.svelte'
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

        it('prefixes layoutId with the group id and a hyphen (matches framer-motion)', () => {
            // Upstream motion/index.tsx useLayoutId: `${layoutGroupId}-${layoutId}`.
            expect(scopeLayoutId('tabs-a', 'underline')).toBe('tabs-a-underline')
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
            expect(flat).toBe('outer-thumb')
            expect(nested).toBe('outer-x-thumb')
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

    it('nested <LayoutGroup inherit="id"> chains the parent id', () => {
        // `inherit="id"` inherits the id but starts its own projection node
        // group — see the node-group cases below.
        render(LayoutGroupProbeHarness, {
            props: { outer: 'outer', inner: 'inner', inherit: 'id' }
        })
        const probe = screen.getByTestId('layout-group-probe')
        expect(probe.getAttribute('data-id')).toBe('outer-inner')
    })
})

/**
 * One-to-one port of upstream's
 * `packages/framer-motion/src/components/LayoutGroup/__tests__/LayoutGroup.test.tsx`
 * (Motion v13.4.5) id-chaining cases.
 */
describe('layoutGroup.context — upstream LayoutGroup.test.tsx parity', () => {
    const probeId = (ids: Array<string | undefined>) => {
        render(NestedLayoutGroupProbeHarness, { props: { ids } })
        return screen.getByTestId('layout-group-probe').getAttribute('data-id')
    }

    it("if it's the first LayoutGroup it sets the group id", () => {
        expect(probeId(['a'])).toBe('a')
    })

    it("if it's a nested LayoutGroup it appends to the group id", () => {
        expect(probeId(['a', 'b'])).toBe('a-b')
    })

    it("if the value of id is undefined, it doesn't change the group id", () => {
        expect(probeId(['a', undefined])).toBe('a')
    })

    it('if the parent group id is undefined, child LayoutGroups still append the group id', () => {
        expect(probeId(['a', undefined, 'b'])).toBe('a-b')
    })
})

/**
 * Node-group publication (upstream `LayoutGroup/index.tsx`):
 * `group: shouldInheritGroup(inherit) ? parent.group || nodeGroup() : nodeGroup()`
 * where only `inherit === true` inherits the group.
 */
describe('layoutGroup.context — projection node group', () => {
    const probe = (testId: string) => {
        const element = screen.getByTestId(testId)
        return { id: element.getAttribute('data-id'), group: element.getAttribute('data-group') }
    }

    it('publishes a node group from a top-level <LayoutGroup>', () => {
        render(NestedLayoutGroupProbeHarness, { props: { ids: ['a'] } })
        expect(probe('layout-group-probe').group).not.toBe('none')
    })

    it('publishes a forceRender function from every <LayoutGroup> (D7)', () => {
        render(NestedLayoutGroupProbeHarness, {
            props: { ids: ['outer', 'inner'], inherits: [true, 'id'], probeEachLevel: true }
        })
        for (const testId of ['layout-group-probe-0', 'layout-group-probe-1']) {
            expect(screen.getByTestId(testId).getAttribute('data-force-render')).toBe('function')
        }
    })

    it('publishes no node group outside <LayoutGroup>', () => {
        render(LayoutGroupProbeHarness)
        expect(probe('layout-group-probe').group).toBe('none')
    })

    it('nested <LayoutGroup> with default inherit shares the parent group object', () => {
        render(NestedLayoutGroupProbeHarness, {
            props: { ids: ['outer', 'inner'], probeEachLevel: true }
        })
        const outer = probe('layout-group-probe-0')
        const inner = probe('layout-group-probe-1')
        expect(outer.group).not.toBe('none')
        expect(inner.group).toBe(outer.group)
        expect(inner.id).toBe('outer-inner')
    })

    it('nested <LayoutGroup inherit="id"> chains the id but gets a new group', () => {
        render(NestedLayoutGroupProbeHarness, {
            props: { ids: ['outer', 'inner'], inherits: [true, 'id'], probeEachLevel: true }
        })
        const outer = probe('layout-group-probe-0')
        const inner = probe('layout-group-probe-1')
        expect(inner.group).not.toBe('none')
        expect(inner.group).not.toBe(outer.group)
        expect(inner.id).toBe('outer-inner')
    })

    it('nested <LayoutGroup inherit={false}> gets a new group and does not chain the id', () => {
        render(NestedLayoutGroupProbeHarness, {
            props: { ids: ['outer', 'inner'], inherits: [true, false], probeEachLevel: true }
        })
        const outer = probe('layout-group-probe-0')
        const inner = probe('layout-group-probe-1')
        expect(inner.group).not.toBe('none')
        expect(inner.group).not.toBe(outer.group)
        expect(inner.id).toBe('inner')
    })
})
