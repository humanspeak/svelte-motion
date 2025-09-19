/**
 * Set of void HTML tag names that cannot contain children.
 *
 * These tags are treated specially by motion components to prevent
 * rendering `children` content and to avoid hydration edge cases.
 *
 * Source: HTML Living Standard — list of void elements.
 * @see https://html.spec.whatwg.org/multipage/syntax.html#void-elements
 */
export const VOID_TAGS = new Set<string>([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
])
