import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import { fileURLToPath } from 'node:url'
import ts from 'typescript-eslint'
const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

export default ts.config(
    includeIgnoreFile(gitignorePath),
    js.configs.recommended,
    ...ts.configs.recommended,
    ...svelte.configs['flat/recommended'],
    prettier,
    ...svelte.configs['flat/prettier'],
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        rules: {
            'dot-location': ['warn', 'property'],
            'guard-for-in': ['warn'],
            camelcase: ['error'],
            'no-unneeded-ternary': ['warn'],
            'no-whitespace-before-property': ['warn'],
            'no-duplicate-imports': ['error'],
            'no-var': ['error'],
            'prefer-const': ['error'],
            semi: 'off',
            'object-curly-spacing': 'off',
            'space-in-parens': 'off',
            'arrow-spacing': 'off',
            'keyword-spacing': 'off',
            'block-spacing': 'off',
            'comma-style': 'off',
            'no-trailing-spaces': 'off',
            'no-multi-spaces': 'off',
            'space-before-blocks': 'off',
            yoda: 'off',
            'comma-dangle': 'off',
            '@typescript-eslint/no-unused-expressions': [
                'error',
                {
                    allowShortCircuit: true,
                    allowTernary: true,
                    allowTaggedTemplates: true
                }
            ],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    ignoreRestSiblings: true
                }
            ]
        }
    },
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parserOptions: {
                parser: ts.parser
            }
        },
        rules: {
            'prefer-const': ['off']
        }
    }
)
