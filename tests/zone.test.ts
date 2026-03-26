import { describe, it, expect } from 'vitest'
import plugin from '../src/index'

describe('cooper.zone()', () => {
  it('should generate all 4 rules with default options', () => {
    const configs = plugin.zone({
      zones: ['src/domain/*'],
      aliases: { '@/': 'src/' },
    })

    expect(configs).toHaveLength(2)

    // Config 1: Import rules
    const importConfig = configs[0]
    expect(importConfig.files).toEqual([
      'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx',
    ])
    expect(importConfig.rules).toHaveProperty('cooper/no-deep-imports')
    expect(importConfig.rules).toHaveProperty('cooper/no-circular-imports')
    expect(importConfig.rules!['cooper/no-deep-imports']).toEqual([
      'error',
      { zones: ['src/domain/*'], aliases: { '@/': 'src/' } },
    ])

    // Config 2: Barrel rules
    const barrelConfig = configs[1]
    expect(barrelConfig.files).toEqual([
      'src/domain/**/index.ts',
      'src/domain/**/index.tsx',
      'src/domain/**/index.js',
      'src/domain/**/index.jsx',
    ])
    expect(barrelConfig.rules).toHaveProperty('cooper/same-level-exports')
    expect(barrelConfig.rules).toHaveProperty('cooper/enforce-export-pattern')
  })

  it('should support zone (singular) shorthand', () => {
    const configs = plugin.zone({ zone: 'src/domain/*' })
    const importRules = configs[0].rules!
    expect(importRules['cooper/no-deep-imports']).toEqual([
      'error',
      { zones: ['src/domain/*'], aliases: {} },
    ])
  })

  it('should infer sourceFiles from common prefix of zones', () => {
    const configs = plugin.zone({
      zones: ['src/domain/*', 'src/features/*'],
    })
    expect(configs[0].files).toEqual([
      'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx',
    ])
  })

  it('should allow overriding sourceFiles', () => {
    const configs = plugin.zone({
      zones: ['src/domain/*'],
      sourceFiles: ['src/**/*.ts', 'tests/**/*.ts'],
    })
    expect(configs[0].files).toEqual(['src/**/*.ts', 'tests/**/*.ts'])
  })

  it('should exclude no-deep-imports when no zones provided', () => {
    const configs = plugin.zone({
      aliases: { '@/': 'src/' },
    })

    // Only import config should have no-circular-imports (no no-deep-imports)
    const importConfig = configs[0]
    expect(importConfig.rules).not.toHaveProperty('cooper/no-deep-imports')
    expect(importConfig.rules).toHaveProperty('cooper/no-circular-imports')

    // No barrel config since no zones means no barrel patterns
    expect(configs).toHaveLength(1)
  })

  it('should exclude rules set to off', () => {
    const configs = plugin.zone({
      zones: ['src/domain/*'],
      rules: {
        'same-level-exports': 'off',
        'no-circular-imports': 'off',
      },
    })

    expect(configs).toHaveLength(2)
    expect(configs[0].rules).not.toHaveProperty('cooper/no-circular-imports')
    expect(configs[1].rules).not.toHaveProperty('cooper/same-level-exports')
    expect(configs[1].rules).toHaveProperty('cooper/enforce-export-pattern')
  })

  it('should merge rule-specific options with shared options', () => {
    const configs = plugin.zone({
      zones: ['src/domain/*'],
      aliases: { '@/': 'src/' },
      rules: {
        'no-circular-imports': ['warn', { maxDepth: 20 }],
      },
    })

    expect(configs[0].rules!['cooper/no-circular-imports']).toEqual([
      'warn',
      { aliases: { '@/': 'src/' }, extensions: ['.ts', '.tsx', '.js', '.jsx'], maxDepth: 20 },
    ])
  })

  it('should support custom extensions and barrelFileNames', () => {
    const configs = plugin.zone({
      zones: ['src/domain/*'],
      extensions: ['.ts'],
      barrelFileNames: ['barrel', 'index'],
    })

    expect(configs[0].files).toEqual(['src/**/*.ts'])
    expect(configs[1].files).toEqual([
      'src/domain/**/barrel.ts',
      'src/domain/**/index.ts',
    ])
  })

  it('should generate no configs when all rules are off', () => {
    const configs = plugin.zone({
      zones: ['src/domain/*'],
      rules: {
        'no-deep-imports': 'off',
        'same-level-exports': 'off',
        'enforce-export-pattern': 'off',
        'no-circular-imports': 'off',
      },
    })
    expect(configs).toHaveLength(0)
  })

  it('should include plugins in each config', () => {
    const configs = plugin.zone({ zones: ['src/domain/*'] })
    for (const config of configs) {
      expect(config.plugins).toHaveProperty('cooper')
      expect(config.plugins!['cooper']).toBe(plugin)
    }
  })
})
