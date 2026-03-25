import type { Linter } from 'eslint'

/**
 * Recommended config — enables all project-agnostic rules at error level.
 *
 * Note: `no-deep-imports` requires project-specific `zones` config,
 * so it is NOT included here. Configure it separately:
 *
 *   'cooper/no-deep-imports': ['error', {
 *     zones: ['src/domain/*']
 *   }]
 */
export function recommended(plugin: Record<string, unknown>): Linter.Config {
  return {
    plugins: {
      'cooper': plugin,
    },
    rules: {
      'cooper/same-level-exports': 'error',
      'cooper/enforce-export-pattern': 'error',
      'cooper/no-circular-imports': 'error',
    },
  }
}
