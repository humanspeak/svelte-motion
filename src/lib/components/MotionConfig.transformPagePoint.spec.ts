import { sleep } from '$lib/utils/testing'
import { render } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TransformPagePointHarness from './__tests__/TransformPagePointHarness.svelte'

describe('MotionConfig.transformPagePoint', () => {
    beforeEach(() => {
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
    })

    describe('config API', () => {
        it('inherits the parent callback when the child prop is omitted', async () => {
            const parentTransformPagePoint = ({ x, y }: { x: number; y: number }) => ({
                x: x * 2,
                y: y * 3
            })
            const { getByTestId } = render(TransformPagePointHarness, {
                props: { parentTransformPagePoint }
            })
            await sleep(40)

            expect(getByTestId('config-probe').getAttribute('data-point')).toBe(
                JSON.stringify({ x: 20, y: 60 })
            )
            const element = getByTestId('motion-target')
            expect(
                (visualElementStore.get(element)?.getProps() as Record<string, unknown>)
                    .transformPagePoint
            ).toBe(parentTransformPagePoint)
        })

        it('uses an explicit child callback, including an identity override', async () => {
            const parentTransformPagePoint = ({ x, y }: { x: number; y: number }) => ({
                x: x * 2,
                y: y * 2
            })
            const identity = (point: { x: number; y: number }) => point
            const { getByTestId } = render(TransformPagePointHarness, {
                props: { parentTransformPagePoint, childTransformPagePoint: identity }
            })
            await sleep(40)

            expect(getByTestId('config-probe').getAttribute('data-point')).toBe(
                JSON.stringify({ x: 10, y: 20 })
            )
            expect(
                (
                    visualElementStore.get(getByTestId('motion-target'))?.getProps() as Record<
                        string,
                        unknown
                    >
                ).transformPagePoint
            ).toBe(identity)
        })

        it('clears inherited mapping with an explicitly undefined child prop', async () => {
            const parentTransformPagePoint = ({ x, y }: { x: number; y: number }) => ({
                x: x * 2,
                y: y * 2
            })
            const { getByTestId, rerender } = render(TransformPagePointHarness, {
                props: { parentTransformPagePoint }
            })
            await sleep(40)

            await rerender({ parentTransformPagePoint, childTransformPagePoint: undefined })
            await sleep(40)

            expect(getByTestId('config-probe').getAttribute('data-point')).toBe('none')
            expect(
                (
                    visualElementStore.get(getByTestId('motion-target'))?.getProps() as Record<
                        string,
                        unknown
                    >
                ).transformPagePoint
            ).toBeUndefined()
        })

        it('applies a new config callback to the mounted VisualElement', async () => {
            const first = ({ x, y }: { x: number; y: number }) => ({ x: x * 2, y: y * 2 })
            const second = ({ x, y }: { x: number; y: number }) => ({ x: x / 2, y: y / 2 })
            const { getByTestId, rerender } = render(TransformPagePointHarness, {
                props: { parentTransformPagePoint: first }
            })
            await sleep(40)
            const element = getByTestId('motion-target')

            await rerender({ parentTransformPagePoint: second })
            await sleep(40)

            expect(getByTestId('motion-target')).toBe(element)
            expect(
                (visualElementStore.get(element)?.getProps() as Record<string, unknown>)
                    .transformPagePoint
            ).toBe(second)
        })
    })

    it('captures gesture input but updates the mounted VisualElement callback live', async () => {
        const first = ({ x, y }: { x: number; y: number }) => ({ x: x * 2, y: y * 2 })
        const second = ({ x, y }: { x: number; y: number }) => ({ x: x * 3, y: y * 3 })
        const { getByTestId, rerender } = render(TransformPagePointHarness, {
            props: { parentTransformPagePoint: first, dragEnabled: true }
        })
        await sleep(80)
        const element = getByTestId('motion-target')
        const visualElement = visualElementStore.get(element)!

        element.dispatchEvent(
            new PointerEvent('pointerdown', {
                clientX: 10,
                clientY: 10,
                pointerId: 10,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: 1
            })
        )
        await rerender({ parentTransformPagePoint: second, dragEnabled: true })
        await sleep(20)
        expect((visualElement.getProps() as Record<string, unknown>).transformPagePoint).toBe(
            second
        )

        window.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 20,
                clientY: 10,
                pointerId: 10,
                pointerType: 'mouse',
                isPrimary: true,
                buttons: 1
            })
        )
        await sleep(20)
        expect(visualElement.latestValues.x).toBe(20)
        window.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 20,
                clientY: 10,
                pointerId: 10,
                pointerType: 'mouse',
                isPrimary: true
            })
        )
        await sleep(20)
        expect((visualElement.getProps() as Record<string, unknown>).transformPagePoint).toBe(
            second
        )

        element.dispatchEvent(
            new PointerEvent('pointerdown', {
                clientX: 10,
                clientY: 10,
                pointerId: 11,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: 1
            })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 20,
                clientY: 10,
                pointerId: 11,
                pointerType: 'mouse',
                isPrimary: true,
                buttons: 1
            })
        )
        await sleep(20)
        expect(visualElement.latestValues.x).toBe(50)
        window.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 20,
                clientY: 10,
                pointerId: 11,
                pointerType: 'mouse',
                isPrimary: true
            })
        )
    })

    it('forwards replacement drag callbacks through the same live VisualElement session', async () => {
        const firstStart = vi.fn()
        const firstMove = vi.fn()
        const firstEnd = vi.fn()
        const result = render(TransformPagePointHarness, {
            props: {
                dragEnabled: true,
                onDragStart: firstStart,
                onDrag: firstMove,
                onDragEnd: firstEnd
            }
        })
        await sleep(80)
        const element = result.getByTestId('motion-target')
        const visualElement = visualElementStore.get(element)!

        element.dispatchEvent(
            new PointerEvent('pointerdown', {
                clientX: 10,
                clientY: 10,
                pointerId: 20,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: 1
            })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 20,
                clientY: 10,
                pointerId: 20,
                pointerType: 'mouse',
                isPrimary: true,
                buttons: 1
            })
        )
        await sleep(20)
        expect(firstStart).toHaveBeenCalledTimes(1)
        expect(firstMove).toHaveBeenCalled()
        const firstMoveCount = firstMove.mock.calls.length

        const nextStart = vi.fn()
        const nextMove = vi.fn()
        const nextEnd = vi.fn()
        await result.rerender({
            dragEnabled: true,
            onDragStart: nextStart,
            onDrag: nextMove,
            onDragEnd: nextEnd
        })
        await sleep(20)

        expect(result.getByTestId('motion-target')).toBe(element)
        expect(visualElementStore.get(element)).toBe(visualElement)
        expect(visualElement.getProps()).toMatchObject({
            onDragStart: nextStart,
            onDrag: nextMove,
            onDragEnd: nextEnd
        })

        window.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 30,
                clientY: 10,
                pointerId: 20,
                pointerType: 'mouse',
                isPrimary: true,
                buttons: 1
            })
        )
        await sleep(20)
        window.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 30,
                clientY: 10,
                pointerId: 20,
                pointerType: 'mouse',
                isPrimary: true
            })
        )
        await sleep(20)

        expect(firstMove).toHaveBeenCalledTimes(firstMoveCount)
        expect(firstEnd).not.toHaveBeenCalled()
        expect(nextStart).not.toHaveBeenCalled()
        expect(nextMove).toHaveBeenCalled()
        expect(nextEnd).toHaveBeenCalledTimes(1)
    })
})
