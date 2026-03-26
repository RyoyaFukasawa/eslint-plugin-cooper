import { RuleTester } from 'eslint'
import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import { enforceExportPattern } from '../src/rules/enforce-export-pattern'
import fs from 'node:fs'

const ruleTester = new RuleTester()

describe('enforce-export-pattern', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'existsSync')
    vi.spyOn(fs, 'statSync')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should enforce export * for directories and named exports for files', () => {
    // Mock: ./posts is a directory, ./utils is a file (utils.ts exists)
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p)
      if (s.endsWith('/posts')) return true
      if (s.endsWith('/utils.ts')) return true
      if (s.endsWith('/utils')) return false
      return false
    })
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const s = String(p)
      if (s.endsWith('/posts')) return { isDirectory: () => true } as fs.Stats
      return { isDirectory: () => false } as fs.Stats
    })

    ruleTester.run('enforce-export-pattern', enforceExportPattern, {
      valid: [
        // Directory uses export * — OK
        {
          code: `export * from './posts'`,
          filename: '/project/src/domain/index.ts',
        },
        // File uses named export — OK
        {
          code: `export { helper } from './utils'`,
          filename: '/project/src/domain/index.ts',
        },
        // Not a barrel file — rule does not apply
        {
          code: `export { Foo } from './posts'`,
          filename: '/project/src/domain/service.ts',
        },
        // No source in export — ignored
        {
          code: `export const x = 1`,
          filename: '/project/src/domain/index.ts',
        },
      ],
      invalid: [
        // Directory uses named export — should use export *
        {
          code: `export { Post } from './posts'`,
          filename: '/project/src/domain/index.ts',
          errors: [
            {
              messageId: 'useExportStar',
              data: { source: './posts' },
            },
          ],
        },
        // File uses export * — should use named exports
        {
          code: `export * from './utils'`,
          filename: '/project/src/domain/index.ts',
          errors: [
            {
              messageId: 'useNamedExports',
              data: { source: './utils' },
            },
          ],
        },
      ],
    })
  })

  it('should support barrelFileNames option', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p)
      if (s.endsWith('/sub')) return true
      return false
    })
    vi.mocked(fs.statSync).mockImplementation(() => {
      return { isDirectory: () => true } as fs.Stats
    })

    ruleTester.run('enforce-export-pattern (barrelFileNames)', enforceExportPattern, {
      valid: [
        // Custom barrel — export * for directory OK
        {
          code: `export * from './sub'`,
          filename: '/project/src/domain/barrel.ts',
          options: [{ barrelFileNames: ['barrel'] }],
        },
        // index.ts is no longer a barrel with custom config
        {
          code: `export { Foo } from './sub'`,
          filename: '/project/src/domain/index.ts',
          options: [{ barrelFileNames: ['barrel'] }],
        },
      ],
      invalid: [
        // Custom barrel — directory with named export
        {
          code: `export { Foo } from './sub'`,
          filename: '/project/src/domain/barrel.ts',
          options: [{ barrelFileNames: ['barrel'] }],
          errors: [{ messageId: 'useExportStar' }],
        },
      ],
    })
  })

  it('should support index.js and other extensions', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p)
      if (s.endsWith('/models')) return true
      return false
    })
    vi.mocked(fs.statSync).mockImplementation(() => {
      return { isDirectory: () => true } as fs.Stats
    })

    ruleTester.run('enforce-export-pattern (extensions)', enforceExportPattern, {
      valid: [
        {
          code: `export * from './models'`,
          filename: '/project/src/index.js',
        },
        {
          code: `export * from './models'`,
          filename: '/project/src/index.jsx',
        },
      ],
      invalid: [
        {
          code: `export { Model } from './models'`,
          filename: '/project/src/index.js',
          errors: [{ messageId: 'useExportStar' }],
        },
      ],
    })
  })
})
