import type { Linter } from 'eslint'
import { DEFAULT_EXTENSIONS } from '../utils'

type RuleSeverity = 'error' | 'warn' | 'off'
type RuleConfig = RuleSeverity | [RuleSeverity, Record<string, unknown>]
type RulesConfig = NonNullable<Linter.Config['rules']>

export interface ZoneConfig {
  zone?: string
  zones?: string[]
  aliases?: Record<string, string>
  extensions?: string[]
  barrelFileNames?: string[]
  sourceFiles?: string[]
  rules?: {
    'no-deep-imports'?: RuleConfig
    'same-level-exports'?: RuleConfig
    'enforce-export-pattern'?: RuleConfig
    'no-circular-imports'?: RuleConfig
  }
}

/**
 * Parse 'error', 'warn', 'off', or ['error', { ...options }] into a
 * normalized { severity, options } pair. Defaults to 'error'.
 */
function parseRule(config: RuleConfig | undefined): {
  severity: RuleSeverity
  options: Record<string, unknown>
} {
  if (config === undefined) return { severity: 'error', options: {} }
  if (typeof config === 'string') return { severity: config, options: {} }
  return { severity: config[0], options: config[1] }
}

/**
 * Build a rule entry like ['error', { zones, aliases, ...overrides }],
 * or return null if the rule is 'off'.
 */
function buildRuleEntry(
  config: RuleConfig | undefined,
  sharedOptions: Record<string, unknown>,
): [RuleSeverity, Record<string, unknown>] | null {
  const { severity, options } = parseRule(config)
  if (severity === 'off') return null
  return [severity, { ...sharedOptions, ...options }]
}

/**
 * Collect non-null rule entries into a RulesConfig, prefixed with 'cooper/'.
 */
function collectRules(
  entries: [string, [RuleSeverity, Record<string, unknown>] | null][],
): RulesConfig {
  const rules: RulesConfig = {}
  for (const [name, entry] of entries) {
    if (entry) rules[`cooper/${name}`] = entry
  }
  return rules
}

/**
 * Find the common path prefix across all zones.
 * e.g. ['src/domain/*', 'src/features/*'] -> 'src/'
 */
function findCommonPrefix(zones: string[]): string {
  const parents = zones.map((z) => z.replace(/\/\*$/, '').split('/').slice(0, -1))
  const first = parents[0]
  if (!first) return ''

  const common: string[] = []
  for (let i = 0; i < first.length; i++) {
    if (parents.every((p) => p[i] === first[i])) {
      common.push(first[i])
    } else {
      break
    }
  }
  return common.length > 0 ? common.join('/') + '/' : ''
}

/** Infer source file globs from the common parent of all zones. */
function inferSourceFiles(zones: string[], extensions: string[]): string[] {
  const base = zones.length > 0 ? findCommonPrefix(zones) : ''
  return extensions.map((ext) => `${base}**/*${ext}`)
}

/** Build barrel file globs from zones, barrelFileNames, and extensions. */
function buildBarrelPatterns(
  zones: string[],
  barrelFileNames: string[],
  extensions: string[],
): string[] {
  return zones.flatMap((zone) => {
    const base = zone.replace(/\/\*$/, '')
    return barrelFileNames.flatMap((name) =>
      extensions.map((ext) => `${base}/**/${name}${ext}`),
    )
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createZone(config: ZoneConfig, plugin: any): Linter.Config[] {
  const zones = config.zones ?? (config.zone ? [config.zone] : [])
  for (const zone of zones) {
    if (!zone.endsWith('/*')) {
      throw new Error(
        `cooper.zone(): Invalid zone "${zone}". Zones must end with "/*" (e.g. "src/domain/*").`,
      )
    }
  }
  const aliases = config.aliases ?? {}
  const extensions = config.extensions ?? DEFAULT_EXTENSIONS
  const barrelFileNames = config.barrelFileNames ?? ['index']
  const sourceFiles = config.sourceFiles ?? inferSourceFiles(zones, extensions)
  const userRules = config.rules ?? {}

  // no-deep-imports requires zones — disable if none provided
  const importRules = collectRules([
    ['no-deep-imports', zones.length > 0
      ? buildRuleEntry(userRules['no-deep-imports'], { zones, aliases })
      : null],
    ['no-circular-imports', buildRuleEntry(userRules['no-circular-imports'], { aliases, extensions })],
  ])

  const barrelRules = collectRules([
    ['same-level-exports', buildRuleEntry(userRules['same-level-exports'], { extensions, barrelFileNames })],
    ['enforce-export-pattern', buildRuleEntry(userRules['enforce-export-pattern'], { extensions, barrelFileNames })],
  ])

  const configs: Linter.Config[] = []
  const pluginEntry = { cooper: plugin }

  if (Object.keys(importRules).length > 0) {
    configs.push({ files: sourceFiles, plugins: pluginEntry, rules: importRules })
  }

  const barrelPatterns = buildBarrelPatterns(zones, barrelFileNames, extensions)
  if (Object.keys(barrelRules).length > 0 && barrelPatterns.length > 0) {
    configs.push({ files: barrelPatterns, plugins: pluginEntry, rules: barrelRules })
  }

  return configs
}
