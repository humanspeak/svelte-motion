import fs from 'fs'
import htmlTags from 'html-tags'
import { htmlVoidElements } from 'html-void-elements'
import path from 'path'
import svgTags from 'svg-tags'

// Elements that should be excluded entirely
const EXCLUDED_TAGS = new Set(['script', 'style', 'link', 'meta', 'title', 'head', 'html', 'body'])

// Canonical lists
const HTML_TAGS: string[] = (htmlTags as string[]).map((t) => t.toLowerCase())
const SVG_TAGS: string[] = (svgTags as string[]).map((t) => t.toLowerCase())
const VOID_ELEMENTS = new Set((htmlVoidElements as string[]).map((t) => t.toLowerCase()))

const FILTERED_HTML = HTML_TAGS.filter((tag) => !EXCLUDED_TAGS.has(tag)).sort()
// Deprecated/removed SVG elements (SVG 2) to exclude from generation
const DEPRECATED_SVG = new Set([
    'animatecolor',
    'altglyph',
    'altglyphdef',
    'altglyphitem',
    'glyph',
    'glyphref',
    'hkern',
    'vkern',
    'missing-glyph',
    'font',
    'font-face',
    'font-face-format',
    'font-face-name',
    'font-face-src',
    'font-face-uri',
    'color-profile'
])
const FILTERED_SVG = SVG_TAGS.filter((tag) => !DEPRECATED_SVG.has(tag)).sort()

const TEMPLATE_PATH = 'scripts/_template.template'
const VOID_TEMPLATE_PATH = 'scripts/_template_void.template'
const OUTPUT_DIR = 'src/lib/html'

const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8')
const voidTemplate = fs.readFileSync(VOID_TEMPLATE_PATH, 'utf-8')

const toComponentName = (tag: string): string =>
    tag
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')

const needsQuoting = (tag: string): boolean => tag.includes('-')

const generateComponentDocs = (tag: string, isVoid: boolean): string => {
    const workingProps = [
        'initial',
        'animate',
        'transition',
        'whileTap',
        'whileHover',
        'onAnimationStart',
        'onAnimationComplete',
        'onHoverStart',
        'onHoverEnd',
        'layout'
    ]
    const propsText = workingProps.map((prop) => `* \`${prop}\``).join('\n     * ')
    const content = isVoid ? '' : 'Content'

    return [
        '    /**',
        `     * A motion-enhanced ${tag} element with animation capabilities.`,
        '     *',
        '     * [Motion Documentation](https://motion.dev/docs/react-motion-component)',
        '     *',
        '     * Currently supported features:',
        `     * ${propsText}`,
        '     *',
        '     * ```svelte',
        `     * <motion.${tag}`,
        '     *   initial={{ opacity: 0, scale: 0.8 }}',
        '     *   animate={{ opacity: 1, scale: 1 }}',
        '     *   transition={{ duration: 0.3 }}',
        '     *   whileHover={{ scale: 1.05 }}',
        '     *   whileTap={{ scale: 0.95 }}',
        isVoid ? '     * />' : `     * >\n     *   ${content}\n     * </motion.${tag}>`,
        '     * ```',
        '     *',
        '     * Note: Some motion features are still under development.',
        '     * Check documentation for latest updates.',
        '     */'
    ].join('\n')
}

// Generate HTML components
FILTERED_HTML.forEach((tag) => {
    const isVoid = VOID_ELEMENTS.has(tag)
    const content = (isVoid ? voidTemplate : template).replace(/{{tag}}/g, tag as string)
    const fileName = `${toComponentName(tag)}.svelte`
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content)
})

// Generate SVG components (never void)
FILTERED_SVG.forEach((tag) => {
    const content = template.replace(/{{tag}}/g, tag as string)
    const fileName = `${toComponentName(tag)}.svelte`
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content)
})

// Generate index.ts
const ALL_TAGS = [...new Set([...FILTERED_HTML, ...FILTERED_SVG])]

const imports = ALL_TAGS.map((tag) => {
    const componentName = toComponentName(tag)
    return `import ${componentName} from '$lib/html/${componentName}.svelte'`
}).join('\n')

const regularElements = [
    ...new Set([...FILTERED_HTML.filter((t) => !VOID_ELEMENTS.has(t)), ...FILTERED_SVG])
].sort()
const voidElements = FILTERED_HTML.filter((tag) => VOID_ELEMENTS.has(tag)).sort()

const typeDefinition = `
export type MotionComponents = {
    ${regularElements
        .map((tag) => {
            const componentName = toComponentName(tag)
            const key = needsQuoting(tag) ? `'${tag}'` : tag
            return `${generateComponentDocs(tag, false)}
    ${key}: typeof ${componentName}`
        })
        .join('\n\n    ')}

    ${voidElements
        .map((tag) => {
            const componentName = toComponentName(tag)
            const key = needsQuoting(tag) ? `'${tag}'` : tag
            return `${generateComponentDocs(tag, true)}
    ${key}: typeof ${componentName}`
        })
        .join('\n\n    ')}
}
`

const indexContent = `${imports}\n\nexport { ${ALL_TAGS.map(
    (tag) => `${toComponentName(tag)}`
).join(', ')} }\n\n${typeDefinition}\n`

fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent)

// // Generate documentation for README.md
// const elementDocs = `## Supported Elements

// ### Regular Elements
// ${regularElements.map((tag) => `- \`motion.${tag}\``).join('\n')}

// ### Void Elements
// ${voidElements.map((tag) => `- \`motion.${tag}\``).join('\n')}

// ## External Dependencies`

// // Read existing README
// const readmePath = 'README.md'
// const readme = fs.readFileSync(readmePath, 'utf-8')

// // Replace or insert the elements section
// const elementsSectionRegex = /## Supported Elements[\s\S]*?## External Dependencies/
// const updatedReadme = readme.includes('## Supported Elements')
//     ? readme.replace(elementsSectionRegex, elementDocs)
//     : readme.replace(/(## Why are we here\?[\s\S]*?\n\n)/, `$1${elementDocs}\n`)

// fs.writeFileSync(readmePath, updatedReadme.trim() + '\n')
