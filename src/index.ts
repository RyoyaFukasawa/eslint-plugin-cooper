import type { Linter, Rule } from 'eslint'
import { meta } from './meta'
import {
  noDeepImports,
  sameLevelExports,
  enforceExportPattern,
  noCircularImports,
} from './rules'
import { createZone, type ZoneConfig } from './configs/zone'

const rules: Record<string, Rule.RuleModule> = {
  'no-deep-imports': noDeepImports,
  'same-level-exports': sameLevelExports,
  'enforce-export-pattern': enforceExportPattern,
  'no-circular-imports': noCircularImports,
}

interface CooperPlugin {
  meta: typeof meta
  rules: Record<string, Rule.RuleModule>
  zone: (config: ZoneConfig) => Linter.Config[]
}

const plugin: CooperPlugin = {
  meta,
  rules,
  zone: (config: ZoneConfig) => createZone(config, plugin),
}

export default plugin
