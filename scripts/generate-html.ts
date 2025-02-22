import fs from 'fs'
import path from 'path'
import type { SvelteHTMLElements } from 'svelte/elements'

// Get all HTML elements from Svelte's type definitions
const HTML_TAGS = [
    'div',
    'span',
    'button',
    'a',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'section',
    'article',
    'nav',
    'aside',
    'main',
    'header',
    'footer',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'table',
    'tr',
    'td',
    'th',
    'thead',
    'tbody',
    'tfoot',
    'form',
    'label',
    'select',
    'option',
    'textarea',
    'fieldset',
    'legend',
    'pre',
    'code',
    'blockquote',
    'figure',
    'figcaption'
] satisfies (keyof SvelteHTMLElements)[]

// Elements that should be excluded entirely
const EXCLUDED_TAGS = new Set(['script', 'style', 'link', 'meta', 'title', 'head', 'html', 'body'])

// Void elements that can't have children
const VOID_ELEMENTS = new Set([
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

const FILTERED_TAGS = [...HTML_TAGS, ...Array.from(VOID_ELEMENTS)]
    .filter((tag) => !EXCLUDED_TAGS.has(tag))
    .sort()

const TEMPLATE_PATH = 'src/lib/html/_template.template'
const VOID_TEMPLATE_PATH = 'src/lib/html/_template_void.template'
const OUTPUT_DIR = 'src/lib/html'

const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8')
const voidTemplate = fs.readFileSync(VOID_TEMPLATE_PATH, 'utf-8')

// Generate components
FILTERED_TAGS.forEach((tag) => {
    const isVoid = VOID_ELEMENTS.has(tag)
    const content = (isVoid ? voidTemplate : template).replace(/{{tag}}/g, tag as string)
    const fileName = `${(tag as string).charAt(0).toUpperCase() + (tag as string).slice(1)}.svelte`
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content)
})

// Generate index.ts
const imports = FILTERED_TAGS.map((tag) => {
    const componentName = `${(tag as string).charAt(0).toUpperCase() + (tag as string).slice(1)}`
    return `import ${componentName} from './${componentName}.svelte'`
}).join('\n')

const exports = `export { ${FILTERED_TAGS.map(
    (tag) => `${(tag as string).charAt(0).toUpperCase() + (tag as string).slice(1)}`
).join(', ')} }`

const indexContent = `${imports}\n\n${exports}\n`
fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent)
