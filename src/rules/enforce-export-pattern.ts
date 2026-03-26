import type { Rule } from 'eslint'
import path from 'node:path'
import fs from 'node:fs'
import { DEFAULT_EXTENSIONS } from '../utils'

/**
 * In barrel files (index.ts):
 * - Directories must use `export * from './dir'`
 * - Files must use named exports `export { Foo } from './file'`
 *
 * Options:
 * - extensions: Array of file extensions to check (default: ['.ts', '.tsx', '.js', '.jsx'])
 * - barrelFileNames: Array of barrel file names without extension (default: ['index'])
 */
export const enforceExportPattern: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Directories must use export *, files must use named exports',
    },
    schema: [
      {
        type: 'object',
        properties: {
          extensions: {
            type: 'array',
            items: { type: 'string' },
          },
          barrelFileNames: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      useExportStar:
        'Use "export * from \'{{source}}\'". The directory\'s barrel file already filters exports.',
      useNamedExports:
        'Use "export { ... } from \'{{source}}\'". Files should use named exports.',
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, '/')
    const options = context.options[0] || {}
    const extensions: string[] = options.extensions || DEFAULT_EXTENSIONS
    const barrelFileNames: string[] = options.barrelFileNames || ['index']

    const isBarrel = barrelFileNames.some((name) =>
      extensions.some((ext) => filename.endsWith(`/${name}${ext}`))
    )
    if (!isBarrel) return {}
    const indexDir = path.dirname(filename)

    function isDirectory(exportPath: string) {
      // Has explicit file extension — it's a file
      const extPattern = new RegExp(`\\.(${extensions.map(e => e.replace('.', '')).join('|')})$`)
      if (extPattern.test(exportPath)) return false

      const resolvedPath = path.resolve(indexDir, exportPath)
      try {
        if (fs.existsSync(resolvedPath)) {
          return fs.statSync(resolvedPath).isDirectory()
        }
        for (const ext of extensions) {
          if (fs.existsSync(resolvedPath + ext)) return false
        }
        return true
      } catch {
        return true
      }
    }

    return {
      ExportNamedDeclaration(node) {
        if (!node.source || node.specifiers.length === 0) return
        const exportPath = node.source.value
        if (typeof exportPath !== 'string' || !exportPath.startsWith('.')) return

        if (isDirectory(exportPath)) {
          context.report({
            node,
            messageId: 'useExportStar',
            data: { source: exportPath },
          })
        }
      },
      ExportAllDeclaration(node) {
        if (!node.source) return
        const exportPath = node.source.value
        if (typeof exportPath !== 'string' || !exportPath.startsWith('.')) return

        if (!isDirectory(exportPath)) {
          context.report({
            node,
            messageId: 'useNamedExports',
            data: { source: exportPath },
          })
        }
      },
    }
  },
}
