import { mergeInlineStyles } from '$lib/utils/style'
import { resolveRestingValues } from '$lib/utils/variants'
import { startWaapiAnimation, type AnimationOptions } from 'motion'
import {
    mapEasingToNativeEasing,
    optimizedAppearDataAttribute,
    optimizedAppearDataId,
    transformProps
} from 'motion-dom'

type AppearValueName = 'opacity' | 'transform'

type OptimizedAppearEntry = {
    name: AppearValueName
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
}

type NativeEasing = Parameters<typeof mapEasingToNativeEasing>[0]

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

    window.MotionHasOptimisedAnimation ??= (elementId?: string, valueName?: string) => {
        if (!elementId) return false
        if (!valueName) return store.complete.has(elementId)
        return store.animations.has(appearStoreId(elementId, valueName))
    }

    window.MotionHandoffMarkAsComplete ??= (elementId: string) => {
        if (store.complete.has(elementId)) {
            store.complete.set(elementId, true)
        }
    }

    window.MotionHandoffIsComplete ??= (elementId: string) => {
        return store.complete.get(elementId) === true
    }

    window.MotionCancelOptimisedAnimation ??= (elementId?: string, valueName?: string) => {
        if (!elementId || !valueName) return
        const animationId = appearStoreId(elementId, valueName)
        const data = store.animations.get(animationId)
        if (!data) return
        data.animation.cancel()
        store.animations.delete(animationId)
        if (!store.animations.size) {
            window.MotionCancelOptimisedAnimation = undefined
        }
    }
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

    const easing = mapEasingToNativeEasing(transition?.ease as NativeEasing, durationMs)
    if (Array.isArray(easing)) {
        options.easing = easing[0] ?? 'linear'
    } else if (easing) {
        options.easing = easing
    }

    return options
}

/**
 * Build serialisable optimized-appear animation entries from an initial and
 * animate pair.
 *
 * @param initial Initial keyframes reflected into SSR markup.
 * @param animate Target keyframes for the enter animation.
 * @param transition Motion transition options.
 * @returns Appear entries for WAAPI-supported opacity and transform values.
 */
export const createOptimizedAppearData = (
    initial: Record<string, unknown> | null | undefined,
    animate: Record<string, unknown> | null | undefined,
    transition?: AnimationOptions
): OptimizedAppearEntry[] => {
    if (!initial || !animate) return []

    const target = resolveRestingValues(animate as never) as Record<string, unknown> | undefined
    if (!target) return []
    const options = toNativeOptions(transition)
    const entries: OptimizedAppearEntry[] = []

    if (initial.opacity != null && target.opacity != null) {
        entries.push({
            name: 'opacity',
            keyframes: [
                Array.isArray(initial.opacity) ? initial.opacity[0] : initial.opacity,
                Array.isArray(target.opacity) ? target.opacity[0] : target.opacity
            ] as [string | number, string | number],
            options
        })
    }

    const initialTransform = readStyleProp(mergeInlineStyles('', initial), 'transform')
    const targetTransform = readStyleProp(mergeInlineStyles('', target), 'transform')
    if (initialTransform && targetTransform && initialTransform !== targetTransform) {
        entries.push({
            name: 'transform',
            keyframes: [initialTransform, targetTransform],
            options
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
 */
export const createOptimizedAppearScript = (
    appearId: string | undefined,
    entries: OptimizedAppearEntry[]
): string => {
    if (!appearId || entries.length === 0) return ''
    const payload = JSON.stringify({ id: appearId, entries }).replace(/</g, '\\u003c')
    return `<script>(()=>{const p=${payload},w=window;if(w.MotionIsMounted)return;const q=String(p.id).replace(/["\\\\]/g,"\\\\$&");const e=document.querySelector('[${optimizedAppearDataAttribute}="'+q+'"]');if(!e||!e.animate)return;const s=w.__SvelteMotionAppear||(w.__SvelteMotionAppear={animations:new Map,complete:new Map,started:[]});const k=(id,n)=>id+": "+(n==="transform"?"transform":n);w.MotionHasOptimisedAnimation=w.MotionHasOptimisedAnimation||((id,n)=>id?n?s.animations.has(k(id,n)):s.complete.has(id):false);w.MotionHandoffMarkAsComplete=w.MotionHandoffMarkAsComplete||((id)=>{if(s.complete.has(id))s.complete.set(id,true)});w.MotionHandoffIsComplete=w.MotionHandoffIsComplete||((id)=>s.complete.get(id)===true);w.MotionCancelOptimisedAnimation=w.MotionCancelOptimisedAnimation||((id,n)=>{const key=k(id,n),d=s.animations.get(key);if(!d)return;d.animation.cancel();s.animations.delete(key);if(!s.animations.size)w.MotionCancelOptimisedAnimation=undefined});s.complete.set(p.id,false);const t=performance.now();for(const a of p.entries){const anim=e.animate({[a.name]:a.keyframes},a.options);anim.startTime=t;s.animations.set(k(p.id,a.name),{animation:anim,startTime:t});s.started.push({id:p.id,name:a.name})}})();</script>`
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
 */
export const startOptimizedAppearAnimation = (
    element: HTMLElement,
    name: AppearValueName,
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

    const animation = startWaapiAnimation(element, name, keyframes, options as never)
    const startTime = performance.now()
    animation.startTime = startTime
    store.complete.set(id, false)
    store.animations.set(appearStoreId(id, name), { animation, startTime })
    store.started.push({ id, name })
    onReady?.(animation)
}

/**
 * Commit and cancel optimized appear animations for an element.
 *
 * @param elementId Optimized appear id.
 * @returns `true` when at least one optimized animation was handed off.
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
 */
export const finishOptimizedAppearAnimation = async (
    elementId: string | undefined
): Promise<boolean> => {
    if (!elementId || typeof window === 'undefined') return false
    const store = getAppearStore()
    if (!store) return false

    const entries = [...store.animations].filter(([key]) => key.startsWith(`${elementId}: `))
    if (!entries.length) return false

    await Promise.all(
        entries.map(([, data]) => {
            return data.animation.finished.catch(() => undefined)
        })
    )

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
 */
export const hasOptimizedAppearAnimation = (elementId: string | undefined): boolean => {
    if (!elementId || typeof window === 'undefined') return false
    return window.MotionHasOptimisedAnimation?.(elementId) ?? false
}

/**
 * Mark Motion as mounted so late optimized-appear starters no-op.
 */
export const markMotionMounted = (): void => {
    if (typeof window !== 'undefined') {
        window.MotionIsMounted = true
    }
}

export { optimizedAppearDataAttribute }
