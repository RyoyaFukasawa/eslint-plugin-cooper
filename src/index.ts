import { meta } from './meta'
import {
  noDeepImports,
  sameLevelExports,
  enforceExportPattern,
  noCircularImports,
} from './rules'
import { recommended } from './configs/recommended'

const rules = {
  'no-deep-imports': noDeepImports,
  'same-level-exports': sameLevelExports,
  'enforce-export-pattern': enforceExportPattern,
  'no-circular-imports': noCircularImports,
}

const plugin = {
  meta,
  rules,
  configs: {} as Record<string, unknown>,
}

// Self-referencing: configs need the plugin instance
plugin.configs = {
  recommended: recommended(plugin),
}

export default plugin
