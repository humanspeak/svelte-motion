import type { VisualElement } from 'motion-dom'
import { describe, expect, it, vi } from 'vitest'

function createValue() {
    return {
        get: () => 0,
        set: () => undefined,
        isAnimating: () => false,
        start: () => undefined,
        stop: () => undefined,
        animation: undefined
    }
}

function createVisualElement(): VisualElement {
    const values: Record<string, ReturnType<typeof createValue>> = {}

    return {
        getDefaultTransition: () => undefined,
        animationState: undefined,
        latestValues: {},
        shouldReduceMotion: false,
        props: {},
        getValue: (key: string) => {
            if (key === 'willChange') return undefined
            return (values[key] ??= createValue())
        },
        addValue: () => undefined
    } as unknown as VisualElement
}

describe('motion-dom SSR compatibility', () => {
    it('can start an animateTarget animation without a browser window', async () => {
        // Import after hiding jsdom's window so motion-dom evaluates its
        // browser-runtime guard under the same conditions as SSR.
        vi.stubGlobal('window', undefined)
        vi.resetModules()

        try {
            const { animateTarget } = await import('motion-dom')

            expect(typeof window).toBe('undefined')
            expect(() => animateTarget(createVisualElement(), { opacity: 1 })).not.toThrow()
        } finally {
            vi.unstubAllGlobals()
            vi.resetModules()
        }
    })
})
