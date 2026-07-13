/**
 * Geometry types shared with the projection system.
 *
 * The legacy home-grown `ProjectionNode` that used to live here was
 * retired in #437 — layout measurement and projection commits now run
 * through the upstream motion-dom `HTMLProjectionNode` via
 * `motionDomProjection.ts`. Only these type mirrors remain.
 *
 * Local mirrors of `motion-utils`'s `Axis` / `Box` types. Inlined
 * because `motion-utils` is a runtime-only transitive dep through
 * `motion-dom` — the runtime helpers (`calcBoxDelta`, `createDelta`,
 * `isDeltaZero`) are re-exported, but the type aliases are not.
 *
 * Values match upstream byte-for-byte so handoff between our types and
 * the runtime helpers from motion-dom is implicit.
 */
export interface Axis {
    min: number
    max: number
}
export interface Box {
    x: Axis
    y: Axis
}
