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

const regularElements = FILTERED_TAGS.filter((tag) => !VOID_ELEMENTS.has(tag)).sort()
const voidElements = FILTERED_TAGS.filter((tag) => VOID_ELEMENTS.has(tag)).sort()

const typeDefinition = `
export type MotionComponents = {
    ${regularElements
        .map((tag) => {
            const componentName = `${tag.charAt(0).toUpperCase() + tag.slice(1)}`
            return `${tag}: typeof ${componentName}`
        })
        .join('\n    ')}

    ${voidElements
        .map((tag) => {
            const componentName = `${tag.charAt(0).toUpperCase() + tag.slice(1)}`
            return `${tag}: typeof ${componentName}`
        })
        .join('\n    ')}
}
`

const indexContent = `${imports}\n\nexport { ${FILTERED_TAGS.map(
    (tag) => `${(tag as string).charAt(0).toUpperCase() + (tag as string).slice(1)}`
).join(', ')} }\n\n${typeDefinition}\n`

fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent)

// Generate documentation for README.md
const elementDocs = `## Supported Elements

### Regular Elements
${regularElements.map((tag) => `- \`motion.${tag}\``).join('\n')}

### Void Elements
${voidElements.map((tag) => `- \`motion.${tag}\``).join('\n')}

## External Dependencies`

// Read existing README
const readmePath = 'README.md'
const readme = fs.readFileSync(readmePath, 'utf-8')

// Replace or insert the elements section
const elementsSectionRegex = /## Supported Elements[\s\S]*?## External Dependencies/
const updatedReadme = readme.includes('## Supported Elements')
    ? readme.replace(elementsSectionRegex, elementDocs)
    : readme.replace(/(## Why are we here\?[\s\S]*?\n\n)/, `$1${elementDocs}\n`)

fs.writeFileSync(readmePath, updatedReadme.trim() + '\n')
