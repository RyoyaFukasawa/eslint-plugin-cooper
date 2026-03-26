import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { describe, it } from 'vitest'
import path from 'node:path'
import { noCircularImports } from '../src/rules/no-circular-imports'

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

const fixturesDir = path.resolve(__dirname, 'fixtures/circular-imports')

describe('no-circular-imports', () => {
  it('should detect direct circular imports (2 nodes)', () => {
    ruleTester.run('no-circular-imports (direct)', noCircularImports, {
      valid: [
        // No circular dependency: c -> d (d has no imports)
        {
          code: `import { d } from './d'`,
          filename: path.join(fixturesDir, 'c.ts'),
        },
        // Type-only imports are ignored
        {
          code: `import type { TypeB } from './type-only-b'`,
          filename: path.join(fixturesDir, 'type-only-a.ts'),
        },
      ],
      invalid: [
        // Circular: a -> b -> a
        {
          code: `import { b } from './b'`,
          filename: path.join(fixturesDir, 'a.ts'),
          errors: [{ messageId: 'circular' }],
        },
        // Circular: b -> a -> b
        {
          code: `import { a } from './a'`,
          filename: path.join(fixturesDir, 'b.ts'),
          errors: [{ messageId: 'circular' }],
        },
      ],
    })
  })

  it('should detect transitive circular imports (3 nodes)', () => {
    ruleTester.run('no-circular-imports (transitive)', noCircularImports, {
      valid: [],
      invalid: [
        // Circular: x -> y -> z -> x
        {
          code: `import { y } from './y'`,
          filename: path.join(fixturesDir, 'x.ts'),
          errors: [{ messageId: 'circular' }],
        },
      ],
    })
  })

  it('should detect circular imports through barrel re-exports', () => {
    ruleTester.run('no-circular-imports (barrel)', noCircularImports, {
      valid: [],
      invalid: [
        // barrel-a/entity -> barrel-b (index) -> barrel-b/entity -> barrel-a (index) -> barrel-a/entity
        {
          code: `import { entityB } from '../barrel-b'`,
          filename: path.join(fixturesDir, 'barrel-a/entity.ts'),
          errors: [{ messageId: 'circular' }],
        },
      ],
    })
  })
})
