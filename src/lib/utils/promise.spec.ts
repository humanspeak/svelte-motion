import { describe, expect, it } from 'vitest'
import { hasFinishedPromise, isPromiseLike } from './promise.js'

describe('utils/promise', () => {
    it('isPromiseLike: positive for thenable', () => {
        const thenable = { then: () => {} }
        expect(isPromiseLike(thenable)).toBe(true)
        expect(isPromiseLike(Promise.resolve())).toBe(true)
    })

    it('isPromiseLike: negative for primitives and objects without then', () => {
        expect(isPromiseLike(null)).toBe(false)
        expect(isPromiseLike(123)).toBe(false)
        expect(isPromiseLike({})).toBe(false)
    })

    it('hasFinishedPromise: positive when finished is a Promise', () => {
        const obj = { finished: Promise.resolve() }
        expect(hasFinishedPromise(obj)).toBe(true)
    })

    it('hasFinishedPromise: negative when finished missing or non-promise', () => {
        expect(hasFinishedPromise({})).toBe(false)
        expect(hasFinishedPromise({ finished: 123 as unknown })).toBe(false)
    })
})
