import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const declaration = path.resolve(import.meta.dirname, '../../dist/reorder.d.ts')
assert.ok(existsSync(declaration), 'The published Reorder declaration must exist.')

const fixture = path.join(import.meta.dirname, 'src/reorder-types.ts')
const program = ts.createProgram([fixture], {
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

console.log('Published Reorder consumer type checks passed.')
