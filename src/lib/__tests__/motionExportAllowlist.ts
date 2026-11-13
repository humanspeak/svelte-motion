/**
 * Runtime exports of `motion` that `src/lib/index.ts` deliberately does not re-export.
 *
 * Every runtime export of `motion` must be either re-exported from `src/lib/index.ts`
 * or listed here (checked by the tripwire in `src/lib/index.spec.ts`). When a Motion
 * bump makes the tripwire fail, decide per new name: re-export it with docs, or add it
 * here under the right group with a reason. The tripwire also fails on stale entries,
 * so a name we start re-exporting must be removed from this list in the same change.
 *
 * Each group comment carries its bucket from plan 014's audit: `[b]` React-only machinery
 * whose user-facing Svelte equivalent we already ship, `[c]` internal / deprecated / dev-only,
 * `[d]` public but pending a Svelte adaptation (mirrored in
 * MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION). The test for a new name: documented on
 * motion.dev, hand-curated in `framer-motion/src/dom.ts`, or a sibling of something we
 * re-export → re-export it (and list it in MOTION_PUBLIC_REEXPORTS); otherwise allowlist it
 * here under a bucket.
 */
export const MOTION_EXPORTS_NOT_REEXPORTED: ReadonlySet<string> = new Set<string>([
    // [b] Renderer and VisualElement internals (props scraping, style/SVG building, variant resolution)
    'buildHTMLStyles',
    'buildSVGAttrs',
    'buildSVGPath',
    'buildTransform',
    'camelCaseAttributes',
    'checkVariantsDidChange',
    'createAnimationState',
    'DOMVisualElement',
    'Feature',
    'getComputedStyle',
    'getFeatureDefinitions',
    'getVariantContext',
    'HTMLVisualElement',
    'isControllingVariants',
    'isForcedMotionValue',
    'isSVGTag',
    'isVariantLabel',
    'isVariantNode',
    'ObjectVisualElement',
    'readTransformValue',
    'renderHTML',
    'renderSVG',
    'resolveVariant',
    'resolveVariantFromProps',
    'scrapeHTMLMotionValuesFromProps',
    'scrapeSVGMotionValuesFromProps',
    'setFeatureDefinitions',
    'setStyle',
    'setTarget',
    'SVGVisualElement',
    'updateMotionValuesFromProps',
    'variantPriorityOrder',
    'variantProps',
    'VisualElement',
    'visualElementStore',

    // [b] Projection and layout internals (boxes, deltas, projection nodes, layout builders)
    'acquireProjectionNode',
    'addScaleCorrector',
    'applyAxisDelta',
    'applyBoxDelta',
    'applyPointDelta',
    'applyTreeDeltas',
    'aspectRatio',
    'axisDeltaEquals',
    'axisEquals',
    'axisEqualsRounded',
    'boxEquals',
    'boxEqualsRounded',
    'buildProjectionTransform',
    'calcAxisDelta',
    'calcBoxDelta',
    'calcLength',
    'calcRelativeAxis',
    'calcRelativeAxisPosition',
    'calcRelativeBox',
    'calcRelativePosition',
    'cleanDirtyNodes',
    'compareByDepth',
    'convertBoundingBoxToBox',
    'convertBoxToBoundingBox',
    'copyAxisDeltaInto',
    'copyAxisInto',
    'copyBoxInto',
    'correctBorderRadius',
    'correctBoxShadow',
    'createAxis',
    'createAxisDelta',
    'createBox',
    'createDelta',
    'createProjectionNode',
    'DocumentProjectionNode',
    'eachAxis',
    'FlatTree',
    'flushLayoutSnapshots',
    'globalProjectionState',
    'has2DTranslate',
    'hasScale',
    'hasTransform',
    'HTMLProjectionNode',
    'isDeltaZero',
    'isNear',
    'LayoutAnimationBuilder',
    'measurePageBox',
    'measureViewportBox',
    'mixValues',
    'nodeGroup',
    'NodeStack',
    'parseAnimateLayoutArgs',
    'pixelsToPercent',
    'propagateDirtyNodes',
    'removeAxisDelta',
    'removeAxisTransforms',
    'removeBoxTransforms',
    'removePointDelta',
    'rootProjectionNode',
    'scaleCorrectors',
    'scalePoint',
    'transformAxis',
    'transformBox',
    'transformBoxPoints',
    'translateAxis',

    // [b] Variant, spring and follow engines behind React components and hooks (ours: variants, useAnimationControls, useSpring, useFollowValue)
    'animateTarget',
    'animateVariant',
    'animateVisualElement',
    'attachFollow',
    'attachSpring',

    // [b] Will-change internals (we ship useWillChange)
    'addValueToWillChange',
    'isWillChangeMotionValue',

    // [b] Gesture, pointer and drag internals
    'addDomEvent',
    'addPinchListeners',
    'addPointerEvent',
    'addPointerInfo',
    'elementDragControls',
    'expectsResolvedDragConstraints',
    'extractEventInfo',
    'isDragActive',
    'isDragging',
    'isElementKeyboardAccessible',
    'isElementTextInput',
    'isNodeOrChild',
    'isPrimaryPointer',
    'PanSession',
    'setDragLock',
    'VisualElementDragControls',

    // [b] Reduced-motion internals (we ship useReducedMotion instead)
    'hasReducedMotionListener',
    'initPrefersReducedMotion',
    'prefersReducedMotion',

    // [b] Optimized-appear internals
    'getOptimisedAppearId',
    'handOffElementState',
    'optimizedAppearDataId',
    'releaseElement',

    // [c] Animation engine classes and helpers (JS/WAAPI animations, generators, transitions)
    'acceleratedValues',
    'animateElement',
    'animateMotionValue',
    'animateSingleValue',
    'animateValue',
    'animateValues',
    'animationMapKey',
    'applyGeneratorOptions',
    'AsyncMotionValueAnimation',
    'calcChildStagger',
    'calcGeneratorDuration',
    'createGeneratorEasing',
    'getAnimationMap',
    'getDefaultTransition',
    'getFinalKeyframe',
    'getOriginIndex',
    'getValueTransition',
    'GroupAnimation',
    'GroupAnimationWithThen',
    'isGenerator',
    'isKeyframesTarget',
    'isTransitionDefined',
    'JSAnimation',
    'makeAnimationInstant',
    'maxGeneratorDuration',
    'NativeAnimation',
    'NativeAnimationExtended',
    'NativeAnimationWrapper',
    'resolveTransition',
    'startWaapiAnimation',

    // [c] Keyframe resolvers and value types
    'alpha',
    'analyseComplexValue',
    'applyPxDefaults',
    'buildTransformer',
    'camelToDash',
    'color',
    'complex',
    'containsCSSVariable',
    'defaultTransformValue',
    'defaultValueTypes',
    'degrees',
    'dimensionValueTypes',
    'DOMKeyframesResolver',
    'fillWildcards',
    'findDimensionValueType',
    'findValueType',
    'flushKeyframeResolvers',
    'getAnimatableNone',
    'getDefaultValueType',
    'getValueAsType',
    'getVariableValue',
    'hasComplexValues',
    'hex',
    'hsla',
    'invisibleValues',
    'isCSSVariableName',
    'isCSSVariableToken',
    'isNumericalString',
    'isZeroValueString',
    'KeyframeResolver',
    'number',
    'numberValueTypes',
    'parseCSSVariable',
    'parseValueFromTransform',
    'percent',
    'positionalKeys',
    'progressPercentage',
    'px',
    'rgba',
    'rgbUnit',
    'scale',
    'testValueType',
    'transformPropOrder',
    'transformProps',
    'transformValueTypes',
    'vh',
    'vw',

    // [c] Motion-value plumbing
    'collectMotionValues',
    'resolveMotionValue',
    'SubscriptionManager',

    // [c] Easing internals (WAAPI/linear() conversion, offsets)
    'convertOffsetToTimes',
    'cubicBezierAsString',
    'defaultEasing',
    'defaultOffset',
    'easingDefinitionToFunction',
    'fillOffset',
    'generateLinearEasing',
    'getEasingForSegment',
    'isBezierDefinition',
    'isEasingArray',
    'isWaapiSupportedEasing',
    'mapEasingToNativeEasing',
    'supportedWaapiEasing',

    // [c] Frameloop, timing and stats internals (cancelSync and sync are deprecated)
    'cancelMicrotask',
    'cancelSync',
    'createRenderBatcher',
    'delayInSeconds',
    'frameSteps',
    'microtask',
    'millisecondsToSeconds',
    'secondsToMilliseconds',
    'statsBuffer',
    'sync',
    'time',
    'velocityPerSecond',

    // [c] Effect internals (the module-level animate carries addEffect/removeEffect)
    'addEffect',
    'animateEffectSubject',
    'findEffect',
    'removeEffect',
    'styleSubjectEffect',
    'svgSubjectEffect',

    // [c] Style/SVG/attr effect internals (behind the re-exported styleEffect/svgEffect/attrEffect)
    'addAttrValue',
    'addStyleValue',
    'addSVGValue',
    'originProps',
    'readStyleValue',
    'readSVGValue',

    // [c] Scope and element resolution internals
    'activeScope',
    'addBuilderToScope',
    'addToScope',
    'bindToScope',
    'isHTMLElement',
    'isObject',
    'isSVGElement',
    'isSVGSVGElement',

    // [c] View transition internals
    'getViewAnimationLayerInfo',
    'getViewAnimations',
    'ViewTransitionBuilder',

    // [c] Feature detection
    'supportsBrowserAnimation',
    'supportsFlags',
    'supportsLinearEasing',
    'supportsPartialKeyframes',
    'supportsScrollTimeline',
    'supportsViewTimeline',
    'supportsWaapi',

    // [c] Colour, mix, array and number utilities not yet re-exported
    'addUniqueItem',
    'getMixer',
    'hslaToRgba',
    'memo',
    'mixArray',
    'mixColor',
    'mixComplex',
    'mixImmediate',
    'mixLinearColor',
    'mixNumber',
    'mixObject',
    'mixVisibility',
    'moveItem',
    'noop',
    'removeItem',
    'round',
    'sampleDelta',

    // [c] Dev warnings
    'hasWarned',
    'invariant',
    'warning',
    'warnOnce',

    // [d] Public, but needs a Svelte adaptation first (plan 014 follow-ups)
    'followValue',
    'MotionValue',
    'recordStats'
])

/**
 * Upstream public, framework-agnostic API that `src/lib/index.ts` must re-export as-is
 * (identical to `motion`'s binding). Bucket (a) of plan 014's audit: hand-curated in
 * `framer-motion/src/dom.ts` (`createScopedAnimate`, `animateMini`), documented on motion.dev
 * (`resolveElements`), or a generator sibling of the re-exported `spring` (`inertia`, `keyframes`).
 */
export const MOTION_PUBLIC_REEXPORTS: readonly string[] = [
    'animateMini',
    'createScopedAnimate',
    'inertia',
    'keyframes',
    'pinch',
    'resolveElements'
]

/**
 * Allowlisted names that are public enough to want but need a Svelte adaptation before they
 * can be exported (plan 014 bucket (d)). Each stays in MOTION_EXPORTS_NOT_REEXPORTED until its
 * follow-up lands; that change removes it from both sets.
 */
export const MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION: ReadonlySet<string> = new Set<string>([
    'followValue', // augmented vanilla factory next to springValue (vanillaValues.svelte.ts)
    'MotionValue', // runtime class vs our MotionValue type
    'recordStats' // upstream ships it only from the motion/debug subpath
])
