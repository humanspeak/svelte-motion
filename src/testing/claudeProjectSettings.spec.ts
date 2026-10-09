import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `.claude/settings.json` is committed and shared with every contributor. These
 * tests pin the reviewed permission boundary: four scoped WebFetch allow rules
 * and nothing else. Widening the set must be a deliberate edit to this file.
 * Only the shared file is read; personal and local settings are never touched.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8')) as Record<
    string,
    unknown
>

const expectedAllow = [
    'WebFetch(domain:codesandbox.io)',
    'WebFetch(domain:*.codesandbox.io)',
    'WebFetch(domain:*.csb.app)',
    'WebFetch(domain:raw.githubusercontent.com)'
]

const permissions = settings.permissions as Record<string, unknown>
const allow = permissions.allow as string[]

describe('shared Claude project settings', () => {
    it('only declares a permissions block', () => {
        const extra = Object.keys(settings).filter((key) => key !== 'permissions')
        expect(extra, `unexpected top-level field(s): ${extra.join(', ')}`).toEqual([])
        expect(permissions).toBeTypeOf('object')
    })

    it('only declares allow rules inside permissions', () => {
        const extra = Object.keys(permissions).filter((key) => key !== 'allow')
        expect(extra, `unexpected permissions field(s): ${extra.join(', ')}`).toEqual([])
        expect(Array.isArray(allow)).toBe(true)
    })

    it('allows exactly the four reviewed WebFetch rules', () => {
        const unexpected = allow.filter((rule) => !expectedAllow.includes(rule))
        const missing = expectedAllow.filter((rule) => !allow.includes(rule))
        expect(unexpected, `unauthorized allow rule(s): ${unexpected.join(', ')}`).toEqual([])
        expect(missing, `missing allow rule(s): ${missing.join(', ')}`).toEqual([])
        expect(allow).toHaveLength(expectedAllow.length)
    })

    it('has no duplicate allow rules', () => {
        const duplicates = allow.filter((rule, index) => allow.indexOf(rule) !== index)
        expect(duplicates, `duplicate allow rule(s): ${duplicates.join(', ')}`).toEqual([])
    })

    it('uses only domain-scoped WebFetch rules without global wildcards', () => {
        const broad = allow.filter(
            (rule) => !/^WebFetch\(domain:(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\)$/.test(rule)
        )
        expect(broad, `non domain-scoped allow rule(s): ${broad.join(', ')}`).toEqual([])
    })
})
