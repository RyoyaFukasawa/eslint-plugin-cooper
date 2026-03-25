import type { Rule } from 'eslint'
import path from 'node:path'

/**
 * Disallow direct imports into protected directories.
 * Forces barrel export (index.ts) usage.
 *
 * Options:
 * - zones: Array of glob-like patterns for protected directories.
 *   The `*` in the pattern represents the barrel boundary.
 * - aliases: Record of path alias to directory mapping (default: {})
 *
 * Example:
 *   'barrel-exports/no-deep-imports': ['error', {
 *     zones: ['src/domain/*', 'src/features/*'],
 *     aliases: { '@/': 'src/' }
 *   }]
 *
 * This means:
 *   import { Post } from '@/domain/posts'           // OK (barrel)
 *   import { Post } from '@/domain/posts/entity'    // Error (deep import)
 */
export const noDeepImports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct imports into protected directories. Use barrel exports (index.ts) instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          zones: {
            type: 'array',
            items: { type: 'string' },
          },
          aliases: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      deepImport:
        'Direct import into "{{importPath}}". Import from "{{suggestedPath}}" instead.',
    },
  },
  create(context) {
    const options = context.options[0] || {}
    const zones: string[] = options.zones || []
    const aliases: Record<string, string> = options.aliases || {}

    if (zones.length === 0) return {}

    const filename = context.filename.replace(/\\/g, '/')

    const zoneMatchers = zones.map((zone: string) => {
      const parentDir = zone.replace(/\/\*$/, '')
      return { zone, parentDir }
    })

    return {
      ImportDeclaration(node) {
        const importPath = node.source?.value
        if (typeof importPath !== 'string') return

        const normalizedPath = normalizeImportPath(importPath, filename, aliases)
        if (!normalizedPath) return

        for (const { parentDir } of zoneMatchers) {
          const match = matchDeepImport(normalizedPath, parentDir)
          if (!match) continue

          // Allow internal imports within the same barrel directory
          const barrelDir = `${parentDir}/${match.barrelName}`
          if (filename.includes(`/${barrelDir}/`)) continue

          const suggestedPath = buildSuggestedPath(importPath, parentDir, match.barrelName, aliases)

          context.report({
            node,
            messageId: 'deepImport',
            data: { importPath, suggestedPath },
          })
          return
        }
      },
    }
  },
}

interface DeepImportMatch {
  barrelName: string
}

function matchDeepImport(normalizedPath: string, parentDir: string): DeepImportMatch | null {
  if (!normalizedPath.startsWith(parentDir + '/')) return null

  const rest = normalizedPath.slice(parentDir.length + 1)
  const parts = rest.split('/')

  if (parts.length < 2) return null

  return { barrelName: parts[0] }
}

function normalizeImportPath(importPath: string, fromFile: string, aliases: Record<string, string>): string | null {
  // Path aliases: { '@/': 'src/', '~/': 'lib/' }
  for (const [alias, target] of Object.entries(aliases)) {
    if (importPath.startsWith(alias)) {
      return target + importPath.slice(alias.length)
    }
  }

  // Relative path
  if (importPath.startsWith('.')) {
    const fromDir = path.dirname(fromFile)
    const resolved = path.resolve(fromDir, importPath)
    // Find the project-relative path by matching zone prefixes
    // Use cwd as the project root
    const cwd = process.cwd().replace(/\\/g, '/')
    if (resolved.startsWith(cwd + '/')) {
      return resolved.slice(cwd.length + 1)
    }
    return null
  }

  return null
}

function buildSuggestedPath(originalPath: string, parentDir: string, barrelName: string, aliases: Record<string, string>): string {
  // If original uses an alias, suggest using the same alias
  for (const [alias, target] of Object.entries(aliases)) {
    if (originalPath.startsWith(alias)) {
      const parentWithoutTarget = parentDir.startsWith(target)
        ? parentDir.slice(target.length)
        : parentDir
      return `${alias}${parentWithoutTarget}/${barrelName}`
    }
  }

  // Relative: trim everything after the barrel name
  const parentSegment = parentDir.split('/').pop() || parentDir
  const regex = new RegExp(`(${parentSegment}/${barrelName})/.*$`)
  return originalPath.replace(regex, `$1`)
}
