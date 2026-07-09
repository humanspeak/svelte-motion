import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import { fileURLToPath } from 'node:url'
import ts from 'typescript-eslint'
const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

export default [
    includeIgnoreFile(gitignorePath),
    {
        ignores: [
            '**/.DS_Store',
            '**/node_modules',
            'postcss.config.cjs',
            '**/build',
            '.svelte-kit',
            'package',
            '**/.env',
            '**/.env.*',
            '!**/.env.example',
            '**/pnpm-lock.yaml',
            '**/package-lock.json',
            '**/yarn.lock',
            '**/dist',
            'vite.config.ts.*'
        ]
    },
    js.configs.recommended,
    ...ts.configs.recommendedTypeChecked,
    ...svelte.configs['flat/recommended'],
    prettier,
    ...svelte.configs['flat/prettier'],
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            },
            parserOptions: {
                tsconfigRootDir: import.meta.dirname
            }
        },

        rules: {
            semi: ['warn', 'never'],
            'dot-location': ['warn', 'property'],
            'guard-for-in': ['warn'],
            'no-multi-spaces': ['warn'],
            yoda: ['warn', 'never'],
            camelcase: ['error'],
            'comma-style': ['warn'],
            'comma-dangle': ['off', 'always-multiline'],
            'block-spacing': ['warn'],
            'keyword-spacing': ['warn'],
            'no-trailing-spaces': ['warn'],
            'no-unneeded-ternary': ['warn'],
            'no-whitespace-before-property': ['warn'],
            'object-curly-spacing': ['warn', 'always'],
            'space-before-blocks': ['warn'],
            'space-in-parens': ['warn'],
            'arrow-spacing': ['warn'],
            'no-duplicate-imports': ['error'],
            'no-var': ['error'],
            'prefer-const': ['error'],
            'svelte/no-navigation-without-resolve': 'off',
            'no-unused-vars': ['off'],
            '@typescript-eslint/no-unused-expressions': [
                'error',
                {
                    allowShortCircuit: true,
                    allowTernary: true,
                    allowTaggedTemplates: true
                }
            ]
        }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts'],
        languageOptions: {
            parserOptions: {
                parser: ts.parser
            }
        },
        rules: {
            'prefer-const': ['off']
        }
    },
    {
        // Type-aware parsing — root package only, never docs/** (docs has its
        // own generated ESLint config owned by docs-kit).
        //
        // Only paths reachable by a real tsconfig are listed. Root config files
        // (`vitest.config.ts`, `playwright.config.ts`, `global.d.ts`, …) and
        // `scripts/**` live in no tsconfig, and `projectService.allowDefaultProject`
        // cannot rescue them here: Trunk runs ESLint against a temp sandbox copy of
        // each file, so the sandboxed path never matches a glob resolved against
        // `tsconfigRootDir`. They fall through to the disableTypeChecked guard below.
        files: ['src/**/*.ts', 'src/**/*.svelte', 'src/**/*.svelte.ts', 'e2e/**/*.ts'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: ['.svelte']
            }
        }
    },
    {
        // No type info here (plain JS, root config files outside every tsconfig,
        // and docs/** when its generated config is absent) — typed rules off,
        // untyped recommended still applies.
        files: [
            '**/*.js',
            '**/*.mjs',
            '**/*.cjs',
            'docs/**',
            '*.ts',
            '*.d.ts',
            'scripts/**/*.ts'
        ],
        ...ts.configs.disableTypeChecked
    },
    {
        // Tests + internal demo routes deliberately bridge motion-dom internals
        // through `any`; the unsafe-* family is noise there — now and for
        // future test code. Library source (src/lib non-spec) keeps these rules.
        files: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**', 'src/routes/tests/**', 'e2e/**'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off'
        }
    },
    {
        /* location of your components where you would like to apply these rules  */
        files: ['**/shadcn/components/ui/**/*.svelte', '**/shadcn/components/ui/**/*.ts'],
        languageOptions: {
            parserOptions: {
                parser: ts.parser
            }
        },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^\\$\\$(Props|Events|Slots|Generic)$'
                }
            ],
            'prefer-const': ['off'],
            'no-unused-vars': ['off']
        }
    }
]
