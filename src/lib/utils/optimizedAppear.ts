import { mergeInlineStyles } from '$lib/utils/style'
import { resolveRestingValues } from '$lib/utils/variants'
import { startWaapiAnimation, type AnimationOptions } from 'motion'
import {
    mapEasingToNativeEasing,
    optimizedAppearDataAttribute,
    optimizedAppearDataId,
    transformProps
} from 'motion-dom'

type OptimizedValueName = 'opacity' | 'transform' | (string & {})

type OptimizedAppearEntry = {
    name: OptimizedValueName
    keyframes: [string | number, string | number]
    options: KeyframeAnimationOptions
}

type AppearStoreEntry = {
    animation: Animation
    startTime: number | null
}

type SvelteMotionAppearStore = {
    animations: Map<string, AppearStoreEntry>
    complete: Map<string, boolean>
    started: Array<{ id: string; name: string }>
    readyAnimation?: Animation
    startFrameTime?: number
}

declare global {
    interface Window {
        __SvelteMotionAppear?: SvelteMotionAppearStore
    }
}

const appearStoreId = (elementId: string, valueName: string): string => {
    const key = transformProps.has(valueName) ? 'transform' : valueName
    return `${elementId}: ${key}`
}

const getAppearStore = (): SvelteMotionAppearStore | undefined => {
    if (typeof window === 'undefined') return undefined
    window.__SvelteMotionAppear ??= {
        animations: new Map(),
        complete: new Map(),
        started: []
    }
    return window.__SvelteMotionAppear
}

const installAppearGlobals = (): void => {
    if (typeof window === 'undefined') return
    const store = getAppearStore()
    if (!store) return

    // Replace the minimal inline-bootstrap functions with the runtime versions.
    // The bootstrap only knows the composite `transform` name; the runtime also
    // receives decomposed MotionValue names such as `x`, `y`, and `scale`.
    window.MotionHasOptimisedAnimation = (elementId?: string, valueName?: string) => {
        if (!elementId) return false
        if (!valueName) return store.complete.has(elementId)
        return store.animations.has(appearStoreId(elementId, valueName))
    }

    window.MotionHandoffMarkAsComplete = (elementId: string) => {
        if (store.complete.has(elementId)) {
            store.complete.set(elementId, true)
        }
    }

    window.MotionHandoffIsComplete = (elementId: string) => {
        return store.complete.get(elementId) === true
    }

    window.MotionCancelOptimisedAnimation = (elementId, valueName, frame) => {
        if (!elementId || !valueName) return
        const animationId = appearStoreId(elementId, valueName)
        const data = store.animations.get(animationId)
        if (!data) return

        // Match Motion's handoff ordering: leave the compositor animation in
        // place until the runtime animation has resolved and rendered its first
        // frame. Cancelling synchronously can expose the SSR initial style for a
        // frame between the two animation owners.
        if (frame) {
            frame.postRender(() => {
                frame.postRender(() => data.animation.cancel())
            })
        } else {
            data.animation.cancel()
        }
        store.animations.delete(animationId)
        if (!store.animations.size) {
            window.MotionCancelOptimisedAnimation = undefined
        }
    }

    window.MotionHandoffAnimation = (elementId, valueName, frame) => {
        const data = store.animations.get(appearStoreId(elementId, valueName))
        if (!data) return null

        const cancelAnimation = () => {
            window.MotionCancelOptimisedAnimation?.(elementId, valueName, frame)
        }
        data.animation.onfinish = cancelAnimation

        // A null start time identifies the paint-ready sentinel. Once the first
        // runtime pass has been marked complete, any later animation is an
        // interruption (exit, gesture, changed animate target), not a handoff.
        if (data.startTime === null || window.MotionHandoffIsComplete?.(elementId)) {
            cancelAnimation()
            return null
        }

        return data.startTime
    }
}

/**
 * Install the browser bridge used by MotionValue animations to adopt an
 * optimized SSR appear animation.
 *
 * @returns Nothing.
 */
export const prepareOptimizedAppearHandoff = (): void => {
    installAppearGlobals()
}

/**
 * Mark an element's first runtime animation pass as handed off.
 *
 * Later animations should interrupt the adopted enter from its current frame
 * instead of sharing the SSR animation's original start time.
 *
 * @param elementId Optimized appear id.
 * @returns Nothing.
 */
export const completeOptimizedAppearHandoff = (elementId: string | undefined): void => {
    if (!elementId || typeof window === 'undefined') return
    window.MotionHandoffMarkAsComplete?.(elementId)
}

const readStyleProp = (style: string, prop: string): string | undefined => {
    return style
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${prop}:`))
        ?.slice(prop.length + 1)
        .trim()
}

const toNativeOptions = (transition: AnimationOptions | undefined): KeyframeAnimationOptions => {
    const duration = typeof transition?.duration === 'number' ? transition.duration : 0.3
    const delay = typeof transition?.delay === 'number' ? transition.delay : 0
    const durationMs = duration * 1000
    const options: KeyframeAnimationOptions = {
        duration: durationMs,
        delay: delay * 1000,
        fill: 'both'
    }

    const easing = mapEasingToNativeEasing(transition?.ease, durationMs)
    if (Array.isArray(easing)) {
        options.easing = easing[0] ?? 'linear'
    } else if (easing) {
        options.easing = easing
    }

    return options
}

/**
 * Non-composite values the appear bootstrap may animate by name. Mirrors
 * upstream motion-dom's `acceleratedValues` allowlist: WAAPI-safe properties
 * that need no Motion-side normalization. `opacity` and the composite
 * `transform` are handled by their dedicated paths in
 * {@link createOptimizedAppearData}; `backgroundColor` stays on the main
 * thread, matching upstream (disabled pending Chromium issue 41491098).
 */
const APPEAR_VALUES = new Set(['filter', 'clipPath'])

/**
 * Resolve the transition for a single value, mirroring upstream motion-dom's
 * `getValueTransition`: a per-key transition replaces the top-level options
 * (merging them only when it opts in via `inherit: true`), falling back to
 * `default` and then the top-level transition.
 */
const getValueTransition = (
    transition: AnimationOptions | undefined,
    key: string
): AnimationOptions | undefined => {
    const record = transition as Record<string, unknown> | undefined
    const valueTransition = (record?.[key] ?? record?.default ?? transition) as
        | (AnimationOptions & { inherit?: boolean })
        | undefined
    if (valueTransition !== transition && valueTransition?.inherit && transition) {
        const merged: AnimationOptions & { inherit?: boolean } = {
            ...transition,
            ...valueTransition
        }
        delete merged.inherit
        return merged
    }
    return valueTransition
}

const extractKeyframeScalar = (value: unknown): string | number | undefined => {
    if (Array.isArray(value)) {
        for (const element of value) {
            if (typeof element === 'string' || typeof element === 'number') return element
        }
        return undefined
    }
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

/**
 * Build serialisable optimized-appear animation entries from an initial and
 * animate pair.
 *
 * Emits one entry per WAAPI-safe property that has a defined value in both
 * the initial and animate keyframe maps. The `transform` composite is built
 * from the resolved inline-style string (so decomposed channels like
 * `x`/`y`/`scale` merge into a single WAAPI entry); `opacity` and the
 * {@link APPEAR_VALUES} allowlist (`filter`, `clipPath`) are emitted by
 * name. Anything else — colors, dimensions, Motion pseudo-properties like
 * `originX` — stays on the main-thread runtime, mirroring upstream
 * motion-dom's `acceleratedValues`. Each entry resolves its own per-key
 * transition (`transition[name] ?? transition.default ?? transition`) so the
 * bootstrap's timing matches what the hydrated runtime will adopt.
 *
 * @param initial Initial keyframes reflected into SSR markup.
 * @param animate Target keyframes for the enter animation.
 * @param transition Motion transition options.
 * @returns Appear entries for the WAAPI-supported properties in `initial`/`animate`.
 *
 * @example
 * ```ts
 * const entries = createOptimizedAppearData(
 *     { opacity: 0, scale: 0.8 },
 *     { opacity: 1, scale: 1 },
 *     { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
 * )
 * ```
 */
export const createOptimizedAppearData = (
    initial: Record<string, unknown> | null | undefined,
    animate: Record<string, unknown> | null | undefined,
    transition?: AnimationOptions
): OptimizedAppearEntry[] => {
    if (!initial || !animate) return []

    const target = resolveRestingValues(animate as never) as Record<string, unknown> | undefined
    if (!target) return []
    const entries: OptimizedAppearEntry[] = []

    if (initial.opacity != null && target.opacity != null) {
        entries.push({
            name: 'opacity',
            keyframes: [
                Array.isArray(initial.opacity) ? initial.opacity[0] : initial.opacity,
                Array.isArray(target.opacity) ? target.opacity[0] : target.opacity
            ] as [string | number, string | number],
            options: toNativeOptions(getValueTransition(transition, 'opacity'))
        })
    }

    const initialTransform = readStyleProp(mergeInlineStyles('', initial, null), 'transform')
    const targetTransform = readStyleProp(mergeInlineStyles('', target, null), 'transform')
    if (initialTransform && targetTransform && initialTransform !== targetTransform) {
        entries.push({
            name: 'transform',
            keyframes: [initialTransform, targetTransform],
            options: toNativeOptions(getValueTransition(transition, 'transform'))
        })
    }

    for (const key of Object.keys(initial)) {
        if (!APPEAR_VALUES.has(key)) continue
        const from = extractKeyframeScalar(initial[key])
        const to = extractKeyframeScalar(target[key])
        if (from === undefined || to === undefined || from === to) continue
        entries.push({
            name: key,
            keyframes: [from, to],
            options: toNativeOptions(getValueTransition(transition, key))
        })
    }

    return entries
}

/**
 * Create the inline SSR bootstrap that starts appear animations before Svelte
 * hydrates the component tree.
 *
 * @param appearId Stable optimized-appear id attached to the motion element.
 * @param entries WAAPI animation entries to start.
 * @returns A script tag string, or an empty string when no entries exist.
 *
 * @example
 * ```ts
 * const script = createOptimizedAppearScript('appear-1', [
 *     { name: 'opacity', keyframes: [0, 1], options: { duration: 300, fill: 'both' } }
 * ])
 * ```
 */
export const createOptimizedAppearScript = (
    appearId: string | undefined,
    entries: OptimizedAppearEntry[]
): string => {
    if (!appearId || entries.length === 0) return ''
    const payload = JSON.stringify({ id: appearId, entries }).replace(/</g, '\\u003c')
    return `<script>(()=>{const p=${payload},w=window;if(w.MotionIsMounted)return;const q=String(p.id).replace(/["\\\\]/g,"\\\\$&");const e=document.querySelector('[${optimizedAppearDataAttribute}="'+q+'"]');if(!e||!e.animate)return;const s=w.__SvelteMotionAppear||(w.__SvelteMotionAppear={animations:new Map,complete:new Map,started:[]});const k=(id,n)=>id+": "+(n==="transform"?"transform":n);w.MotionHasOptimisedAnimation=w.MotionHasOptimisedAnimation||((id,n)=>id?n?s.animations.has(k(id,n)):s.complete.has(id):false);w.MotionHandoffMarkAsComplete=w.MotionHandoffMarkAsComplete||((id)=>{if(s.complete.has(id))s.complete.set(id,true)});w.MotionHandoffIsComplete=w.MotionHandoffIsComplete||((id)=>s.complete.get(id)===true);w.MotionCancelOptimisedAnimation=w.MotionCancelOptimisedAnimation||((id,n)=>{const key=k(id,n),d=s.animations.get(key);if(!d)return;d.animation.cancel();s.animations.delete(key);if(!s.animations.size)w.MotionCancelOptimisedAnimation=undefined});s.complete.set(p.id,false);for(const a of p.entries){const key=k(p.id,a.name);if(!s.readyAnimation){s.readyAnimation=e.animate({[a.name]:[a.keyframes[0],a.keyframes[0]]},{duration:1e4,easing:"linear",fill:"both"});s.animations.set(key,{animation:s.readyAnimation,startTime:null})}const start=()=>{s.readyAnimation.cancel();let t=s.startFrameTime;if(t===undefined){t=performance.now();s.startFrameTime=t}const anim=e.animate({[a.name]:a.keyframes},a.options);anim.startTime=t;s.animations.set(key,{animation:anim,startTime:t});s.started.push({id:p.id,name:a.name})};const r=s.readyAnimation;r.ready?r.ready.then(start).catch(()=>{}):start()}})();</script>`
}

/**
 * Start an optimized appear animation imperatively.
 *
 * Mirrors Framer Motion's `startOptimizedAppearAnimation`: if Motion has
 * already mounted, this intentionally does nothing.
 *
 * @param element Element carrying `data-framer-appear-id`.
 * @param name CSS property to animate.
 * @param keyframes WAAPI keyframes for the property.
 * @param options Motion animation options.
 * @param onReady Optional callback receiving the started animation.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * const element = document.querySelector('[data-framer-appear-id]')
 * if (element instanceof HTMLElement) {
 *     startOptimizedAppearAnimation(element, 'opacity', [0, 1], { duration: 0.3 })
 * }
 * ```
 */
export const startOptimizedAppearAnimation = (
    element: HTMLElement,
    name: OptimizedValueName,
    keyframes: string[] | number[],
    options: AnimationOptions,
    onReady?: (animation: Animation) => void
): void => {
    if (typeof window === 'undefined' || window.MotionIsMounted) return
    const id = element.dataset[optimizedAppearDataId]
    if (!id) return

    installAppearGlobals()
    const store = getAppearStore()
    if (!store) return

    const storeId = appearStoreId(id, name)
    if (!store.readyAnimation) {
        store.readyAnimation = startWaapiAnimation(element, name, [keyframes[0], keyframes[0]], {
            duration: 10000,
            ease: 'linear'
        } as never)
        store.animations.set(storeId, { animation: store.readyAnimation, startTime: null })
    }

    const startAnimation = () => {
        store.readyAnimation?.cancel()
        store.startFrameTime ??= performance.now()
        const animation = startWaapiAnimation(element, name, keyframes, options as never)
        animation.startTime = store.startFrameTime
        store.animations.set(storeId, { animation, startTime: store.startFrameTime })
        store.started.push({ id, name })
        onReady?.(animation)
    }

    store.complete.set(id, false)
    const readyAnimation = store.readyAnimation
    // Feature detection, not a completion check: `ready` is a Promise, so a bare
    // truthiness test is always true once the property exists.
    if (readyAnimation.ready !== undefined) {
        readyAnimation.ready.then(startAnimation).catch(() => {})
    } else {
        startAnimation()
    }
}

/**
 * Commit and cancel optimized appear animations for an element.
 *
 * @param elementId Optimized appear id.
 * @returns `true` when at least one optimized animation was handed off.
 *
 * @example
 * ```ts
 * const wasHandedOff = handoffOptimizedAppearAnimation('appear-1')
 * if (wasHandedOff) {
 *     console.log('Animation handed off to runtime')
 * }
 * ```
 */
export const handoffOptimizedAppearAnimation = (elementId: string | undefined): boolean => {
    if (!elementId || typeof window === 'undefined') return false
    const store = getAppearStore()
    if (!store) return false

    let handedOff = false
    for (const [key, data] of [...store.animations]) {
        if (!key.startsWith(`${elementId}: `)) continue
        data.animation.commitStyles?.()
        data.animation.cancel()
        store.animations.delete(key)
        handedOff = true
    }

    if (store.complete.has(elementId)) {
        store.complete.set(elementId, true)
    }

    return handedOff
}

/**
 * Let active optimized appear animations finish before handing their final
 * styles back to Svelte Motion.
 *
 * @param elementId Optimized appear id.
 * @returns Whether at least one optimized animation was adopted.
 *
 * @example
 * ```ts
 * const wasAdopted = await finishOptimizedAppearAnimation('appear-1')
 * if (wasAdopted) {
 *     console.log('Animation finished and adopted')
 * }
 * ```
 */
export const finishOptimizedAppearAnimation = async (
    elementId: string | undefined
): Promise<boolean> => {
    if (!elementId || typeof window === 'undefined') return false
    const store = getAppearStore()
    if (!store) return false

    let entries = [...store.animations].filter(([key]) => key.startsWith(`${elementId}: `))
    if (!entries.length) return false

    // `flatMap` rather than `map`: the old form fed `undefined` into `Promise.all`
    // for every entry that had nothing to wait on.
    await Promise.all(
        entries.flatMap(([, data]) =>
            data.startTime === null && data.animation.ready !== undefined
                ? [data.animation.ready.catch(() => undefined)]
                : []
        )
    )

    entries = [...store.animations].filter(([key]) => key.startsWith(`${elementId}: `))
    await Promise.all(entries.map(([, data]) => data.animation.finished.catch(() => undefined)))

    for (const [key, data] of entries) {
        if (!store.animations.has(key)) continue
        data.animation.commitStyles?.()
        data.animation.cancel()
        store.animations.delete(key)
    }

    if (store.complete.has(elementId)) {
        store.complete.set(elementId, true)
    }

    return true
}

/**
 * Check whether an optimized appear animation is active for an element.
 *
 * @param elementId Optimized appear id.
 * @returns Whether any optimized appear animation is currently registered.
 *
 * @example
 * ```ts
 * if (hasOptimizedAppearAnimation('appear-1')) {
 *     console.log('Animation is active')
 * }
 * ```
 */
export const hasOptimizedAppearAnimation = (elementId: string | undefined): boolean => {
    if (!elementId || typeof window === 'undefined') return false
    return window.MotionHasOptimisedAnimation?.(elementId) ?? false
}

/**
 * Mark Motion as mounted so late optimized-appear starters no-op.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * markMotionMounted()
 * ```
 */
export const markMotionMounted = (): void => {
    if (typeof window !== 'undefined') {
        window.MotionIsMounted = true
    }
}

export { optimizedAppearDataAttribute }
