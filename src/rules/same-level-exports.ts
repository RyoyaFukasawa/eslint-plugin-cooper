import type { Rule } from 'eslint'
import path from 'node:path'
import { DEFAULT_EXTENSIONS } from '../utils'

/**
 * Barrel files (index.ts/index.js) may only re-export from same-level files.
 * Prevents deep re-exports that bypass barrel boundaries.
 *
 * Options:
 * - extensions: Array of file extensions for barrel files (default: ['.ts', '.tsx', '.js', '.jsx'])
 */
export const sameLevelExports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Barrel files (index.*) may only export from same-level files',
    },
    schema: [
      {
        type: 'object',
        properties: {
          extensions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      deepExport:
        'Barrel file cannot export from "{{exportPath}}". Only same-level files are allowed.',
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, '/')
    const options = context.options[0] || {}
    const extensions: string[] = options.extensions || DEFAULT_EXTENSIONS

    // Check if this file is a barrel (index.*)
    const isBarrel = extensions.some((ext) => filename.endsWith(`/index${ext}`))
    if (!isBarrel) return {}

    const indexDir = path.dirname(filename)

    function checkExport(node: Rule.Node & { source?: { value: unknown } }) {
      if (!node.source) return
      const exportPath = node.source.value
      if (typeof exportPath !== 'string' || !exportPath.startsWith('.')) return

      const resolvedPath = path.resolve(indexDir, exportPath)
      const resolvedDir = path.dirname(resolvedPath)

      if (resolvedDir !== indexDir) {
        context.report({
          node,
          messageId: 'deepExport',
          data: { exportPath },
        })
      }
    }

    return {
      ExportNamedDeclaration: checkExport,
      ExportAllDeclaration: checkExport,
    }
  },
}
