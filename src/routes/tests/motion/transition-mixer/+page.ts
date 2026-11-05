// Build this page in the browser, like upstream's animate-mixer.html. Server
// rendering paints each box at its unanimated style until it hydrates (as
// framer-motion's SSR output does with no `initial`), so the opacity box would
// show solid, snap to 0 and then fade in.
export const ssr = false
