import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * svelte-motion depends on `motion` AND `motion-dom` directly. Since Motion
 * 14.0.0, upstream pins its internal packages to each other exactly
 * (`motion` → `framer-motion` → `motion-dom` → `motion-utils`, all the same
 * version). If our own `motion-dom` range resolved to a different version than
 * the one `motion` pins, an app would load two copies of motion-dom and split
 * its shared state: the frameloop, the VisualElement store, and the scale-correction
 * registry. These tests keep the two dependencies locked together.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
}

/** Directory of the installed package that `entry` (a resolved file) belongs to. */
const packageDir = (entry: string, name: string): string => {
    const marker = `${sep}node_modules${sep}${name}${sep}`
    const real = realpathSync(entry)
    const at = real.lastIndexOf(marker)
    return at === -1 ? real : real.slice(0, at + marker.length - 1)
}

describe('motion dependency pins', () => {
    it('pins motion and motion-dom to the same exact version', () => {
        const { motion, 'motion-dom': motionDom } = pkg.dependencies
        expect(motion, 'motion must be an exact version').toMatch(/^\d+\.\d+\.\d+$/u)
        expect(motionDom, 'motion-dom must be an exact version').toMatch(/^\d+\.\d+\.\d+$/u)
        expect(motionDom).toBe(motion)
    })

    it('resolves a single motion-dom shared with motion → framer-motion', () => {
        const fromRoot = createRequire(join(root, 'package.json'))
        const ours = packageDir(fromRoot.resolve('motion-dom'), 'motion-dom')

        const fromMotion = createRequire(fromRoot.resolve('motion'))
        const fromFramer = createRequire(fromMotion.resolve('framer-motion'))
        const theirs = packageDir(fromFramer.resolve('motion-dom'), 'motion-dom')

        expect(theirs).toBe(ours)
    })
})
