import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const declaration = path.resolve(import.meta.dirname, '../../dist/reorder.d.ts')
assert.ok(existsSync(declaration), 'The published Reorder declaration must exist.')
const mDeclaration = path.resolve(import.meta.dirname, '../../dist/m.d.ts')
assert.ok(existsSync(mDeclaration), 'The published ./m entry declaration must exist.')

// The main Reorder and the `./m` entry's Reorder (#2232) must type the same.
const fixtures = ['src/reorder-types.ts', 'src/reorder-m-types.ts'].map((file) =>
    path.join(import.meta.dirname, file)
)
const program = ts.createProgram(fixtures, {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true
})
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => import.meta.dirname,
        getNewLine: () => '\n'
    })
)

console.log('Published Reorder (main and ./m) consumer type checks passed.')
