import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { noDeepImports } from '../src/rules/no-deep-imports'

const ruleTester = new RuleTester()

const options = [
  {
    zones: ['src/domain/*', 'src/features/*'],
    aliases: { '@/': 'src/' },
  },
]

describe('no-deep-imports', () => {
  it('should pass and fail correctly', () => {
    ruleTester.run('no-deep-imports', noDeepImports, {
      valid: [
        // Barrel import via alias
        {
          code: `import { Post } from '@/domain/posts'`,
          options,
        },
        // Barrel import via alias (features)
        {
          code: `import { Auth } from '@/features/auth'`,
          options,
        },
        // Not in a protected zone
        {
          code: `import { utils } from '@/lib/utils'`,
          options,
        },
        // Internal import within the same barrel directory
        {
          code: `import { Entity } from './entity'`,
          options,
          filename: '/project/src/domain/posts/service.ts',
        },
        // node_modules import (ignored)
        {
          code: `import React from 'react'`,
          options,
        },
        // No zones configured — rule is a no-op
        {
          code: `import { Post } from '@/domain/posts/entity'`,
          options: [{ zones: [] }],
        },
      ],
      invalid: [
        // Deep import via alias
        {
          code: `import { Post } from '@/domain/posts/entity'`,
          options,
          errors: [
            {
              messageId: 'deepImport',
              data: {
                importPath: '@/domain/posts/entity',
                suggestedPath: '@/domain/posts',
              },
            },
          ],
        },
        // Deep import via alias (features)
        {
          code: `import { handler } from '@/features/auth/handler'`,
          options,
          errors: [
            {
              messageId: 'deepImport',
              data: {
                importPath: '@/features/auth/handler',
                suggestedPath: '@/features/auth',
              },
            },
          ],
        },
        // Even deeper import
        {
          code: `import { Foo } from '@/domain/posts/models/foo'`,
          options,
          errors: [{ messageId: 'deepImport' }],
        },
      ],
    })
  })
})
