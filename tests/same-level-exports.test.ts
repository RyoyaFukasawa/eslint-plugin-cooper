import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { sameLevelExports } from '../src/rules/same-level-exports'

const ruleTester = new RuleTester()

describe('same-level-exports', () => {
  it('should allow same-level exports and reject deep exports', () => {
    ruleTester.run('same-level-exports', sameLevelExports, {
      valid: [
        // Same-level named export
        {
          code: `export { Foo } from './foo'`,
          filename: '/project/src/domain/index.ts',
        },
        // Same-level export all
        {
          code: `export * from './bar'`,
          filename: '/project/src/domain/index.ts',
        },
        // Not a barrel file — rule does not apply
        {
          code: `export { Deep } from './sub/deep'`,
          filename: '/project/src/domain/foo.ts',
        },
        // index.js also recognized
        {
          code: `export { Foo } from './foo'`,
          filename: '/project/src/domain/index.js',
        },
      ],
      invalid: [
        // Deep re-export from a barrel file
        {
          code: `export { Deep } from './sub/deep'`,
          filename: '/project/src/domain/index.ts',
          errors: [
            {
              messageId: 'deepExport',
              data: { exportPath: './sub/deep' },
            },
          ],
        },
        // Deep export-all from a barrel file
        {
          code: `export * from './nested/module'`,
          filename: '/project/src/domain/index.ts',
          errors: [{ messageId: 'deepExport' }],
        },
        // index.jsx
        {
          code: `export { X } from '../other/thing'`,
          filename: '/project/src/domain/index.jsx',
          errors: [{ messageId: 'deepExport' }],
        },
      ],
    })
  })

  it('should support barrelFileNames option', () => {
    ruleTester.run('same-level-exports (barrelFileNames)', sameLevelExports, {
      valid: [
        // Custom barrel file name — not a barrel anymore
        {
          code: `export { Deep } from './sub/deep'`,
          filename: '/project/src/domain/index.ts',
          options: [{ barrelFileNames: ['barrel'] }],
        },
        // Custom barrel file name — same-level is OK
        {
          code: `export { Foo } from './foo'`,
          filename: '/project/src/domain/barrel.ts',
          options: [{ barrelFileNames: ['barrel'] }],
        },
      ],
      invalid: [
        // Custom barrel file name — deep export
        {
          code: `export { Deep } from './sub/deep'`,
          filename: '/project/src/domain/barrel.ts',
          options: [{ barrelFileNames: ['barrel'] }],
          errors: [{ messageId: 'deepExport' }],
        },
      ],
    })
  })
})
