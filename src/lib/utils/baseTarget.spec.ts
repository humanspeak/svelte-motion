/**
 * @vitest-environment jsdom
 */
import { VisualElement, motionValue, type MotionNodeOptions } from 'motion-dom'
import { describe, expect, it } from 'vitest'
import { resolveBaseTarget } from './baseTarget.js'
import { createMotionVisualElement } from './visualElementCore.js'

/** Props accepted by the VisualElement at runtime, including `style`. */
type Props = MotionNodeOptions & { style?: Record<string, unknown> }

const variants = { hidden: { opacity: 0.1 }, other: { opacity: 0.9 } }

/** Builds and mounts a real VisualElement on a fresh div. */
const mount = (props: Props) => {
    const ve = createMotionVisualElement({ props })
    ve.mount(document.createElement('div'))
    return ve
}

type Case = { name: string; props: Props; prime?: boolean }

const cases: Case[] = [
    { name: 'initial object', props: { initial: { opacity: 0 } } },
    { name: 'initial variant label', props: { initial: 'hidden', variants } },
    { name: 'style value', props: { style: { opacity: 0.5 } } },
    { name: 'MotionValue in style', props: { style: { opacity: motionValue(0.4) } } },
    { name: 'read value only', props: {}, prime: true },
    { name: 'initial false + style', props: { initial: false, style: { opacity: 0.3 } } },
    { name: 'array initial', props: { initial: ['hidden', 'other'], variants } }
]

describe.skipIf(typeof VisualElement.prototype.getBaseTarget !== 'function')(
    'resolveBaseTarget parity with VisualElement.getBaseTarget',
    () => {
        it.each(cases)('$name', ({ props, prime }) => {
            const ve = mount(props)
            if (prime) ve.readValue('opacity')
            const expected = ve.getBaseTarget('opacity')
            expect(resolveBaseTarget(ve, 'opacity') ?? null).toEqual(expected ?? null)
        })
    }
)

describe('resolveBaseTarget values', () => {
    it.each([
        ['initial object', { initial: { opacity: 0 } }, 0],
        ['initial variant label', { initial: 'hidden', variants }, 0.1],
        ['style value', { style: { opacity: 0.5 } }, 0.5],
        ['initial false + style', { initial: false, style: { opacity: 0.3 } }, 0.3]
    ] as [string, Props, number][])('%s', (_name, props, value) => {
        expect(resolveBaseTarget(mount(props), 'opacity')).toBe(value)
    })

    it('returns undefined when nothing applies', () => {
        expect(resolveBaseTarget(mount({}), 'opacity')).toBeUndefined()
    })
})
