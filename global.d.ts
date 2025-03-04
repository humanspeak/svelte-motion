interface Window {
    __testCleanup?: {
        requestAnimationFrame: typeof requestAnimationFrame
        performanceNow: typeof performance.now
    }
}
