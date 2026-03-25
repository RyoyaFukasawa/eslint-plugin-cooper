import type { Rule } from 'eslint'
import path from 'node:path'
import fs from 'node:fs'
import { DEFAULT_EXTENSIONS } from '../utils'

/**
 * Detect circular imports by recursively following import chains.
 * Works through barrel exports (index.ts), unlike import-x/no-cycle.
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

function extractImports(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const imports: string[] = []

    // import ... from '...' / export ... from '...' / export * from '...'
    const regex = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+|(?:\*\s+from\s+))['"]([^'"]+)['"]/g

    let match
    while ((match = regex.exec(content)) !== null) {
      if (!imports.includes(match[1])) {
        imports.push(match[1])
      }
    }

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
