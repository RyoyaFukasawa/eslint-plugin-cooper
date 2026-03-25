import type { Rule } from 'eslint'
import path from 'node:path'
import fs from 'node:fs'
import ts from 'typescript'
import { DEFAULT_EXTENSIONS } from '../utils'

/**
 * Detect circular imports by recursively following import chains.
 * Works through barrel exports (index.ts).
 *
 * Uses TypeScript Compiler API for accurate AST parsing.
 * Type-only imports (`import type`) are always ignored.
 *
 * Options:
 * - aliases: Record of path alias to directory mapping (default: {})
 * - extensions: Array of file extensions to resolve (default: ['.ts', '.tsx', '.js', '.jsx'])
 * - maxDepth: Maximum recursion depth (default: 10)
 */
export const noCircularImports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect circular import dependencies, including through barrel exports',
    },
    schema: [
      {
        type: 'object',
        properties: {
          aliases: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          extensions: {
            type: 'array',
            items: { type: 'string' },
          },
          maxDepth: {
            type: 'number',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      circular: 'Circular import detected: {{chain}}',
    },
  },
  create(context) {
    const filename = path.resolve(context.filename)
    const options = context.options[0] || {}
    const aliases: Record<string, string> = options.aliases || {}
    const extensions: string[] = options.extensions || DEFAULT_EXTENSIONS
    const maxDepth: number = options.maxDepth || 10

    return {
      Program(node) {
        const chain = detectCycle(filename, aliases, extensions, maxDepth)
        if (chain) {
          const relativeChain = chain.map((f) => path.relative(process.cwd(), f)).join(' → ')
          context.report({
            node,
            messageId: 'circular',
            data: { chain: relativeChain },
          })
        }
      },
    }
  },
}

function resolveImportPath(importPath: string, fromFile: string, aliases: Record<string, string>, extensions: string[]): string | null {
  const fromDir = path.dirname(fromFile)

  // Handle path aliases
  for (const [alias, target] of Object.entries(aliases)) {
    if (importPath.startsWith(alias)) {
      const aliasDir = path.resolve(target)
      const aliasPath = importPath.replace(alias, aliasDir + '/')
      return resolveFilePath(aliasPath, extensions)
    }
  }

  // Relative imports
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(fromDir, importPath)
    return resolveFilePath(resolved, extensions)
  }

  return null // Skip node_modules
}

function resolveFilePath(filePath: string, extensions: string[]): string | null {
  // Direct file with extension
  for (const ext of extensions) {
    if (fs.existsSync(filePath + ext)) return filePath + ext
  }

  // Directory with index
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    for (const ext of extensions) {
      const indexPath = path.join(filePath, 'index' + ext)
      if (fs.existsSync(indexPath)) return indexPath
    }
  }

  // Exact match
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath

  return null
}

/**
 * Extract non-type-only import/export paths from a file using TypeScript AST.
 */
function extractImports(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, false)
    const imports: string[] = []

    ts.forEachChild(sourceFile, function visit(node) {
      // import ... from '...'
      if (ts.isImportDeclaration(node)) {
        if (node.importClause?.isTypeOnly) return // import type { ... } from '...'
        const specifier = node.moduleSpecifier
        if (ts.isStringLiteral(specifier)) {
          // Check if all named imports are type-only: import { type A, type B } from '...'
          const namedBindings = node.importClause?.namedBindings
          if (namedBindings && ts.isNamedImports(namedBindings)) {
            const allTypeOnly = namedBindings.elements.every((el) => el.isTypeOnly)
            if (allTypeOnly) return
          }
          if (!imports.includes(specifier.text)) {
            imports.push(specifier.text)
          }
        }
        return
      }

      // export ... from '...' / export * from '...'
      if (ts.isExportDeclaration(node)) {
        if (node.isTypeOnly) return // export type { ... } from '...'
        const specifier = node.moduleSpecifier
        if (specifier && ts.isStringLiteral(specifier)) {
          // Check if all named exports are type-only: export { type A } from '...'
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            const allTypeOnly = node.exportClause.elements.every((el) => el.isTypeOnly)
            if (allTypeOnly) return
          }
          if (!imports.includes(specifier.text)) {
            imports.push(specifier.text)
          }
        }
        return
      }
    })

    return imports
  } catch {
    return []
  }
}

function detectCycle(
  startFile: string,
  aliases: Record<string, string>,
  extensions: string[],
  maxDepth: number,
  visited: Set<string> = new Set(),
  chain: string[] = [],
  depth = 0,
): string[] | null {
  if (depth > maxDepth) return null

  if (visited.has(startFile)) {
    return [...chain, startFile]
  }

  visited.add(startFile)
  chain.push(startFile)

  const imports = extractImports(startFile)

  for (const imp of imports) {
    const resolved = resolveImportPath(imp, startFile, aliases, extensions)
    if (!resolved) continue

    const result = detectCycle(resolved, aliases, extensions, maxDepth, new Set(visited), [...chain], depth + 1)
    if (result) return result
  }

  return null
}
