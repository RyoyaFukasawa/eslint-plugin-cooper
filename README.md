# eslint-plugin-cooper

> The barrel craftsman for your codebase.

[![npm version](https://img.shields.io/npm/v/eslint-plugin-cooper.svg)](https://www.npmjs.com/package/eslint-plugin-cooper)
[![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-cooper.svg)](https://www.npmjs.com/package/eslint-plugin-cooper)
[![license](https://img.shields.io/npm/l/eslint-plugin-cooper.svg)](https://github.com/ryoyafukasawa/eslint-plugin-cooper/blob/main/LICENSE)

ESLint plugin that enforces **barrel export** (`index.ts`) boundaries and detects **circular imports** — including through barrel re-exports. Catches circular dependencies that other tools miss by following the full import chain.

## What it does

| Rule | What it enforces |
|------|-----------------|
| `no-deep-imports` | `import from '@/domain/posts'` OK, `import from '@/domain/posts/entity'` NG |
| `same-level-exports` | Barrel files can only re-export from same-level files |
| `enforce-export-pattern` | Directories use `export *`, files use `export { named }` |
| `no-circular-imports` | Detects circular imports through barrel re-exports |

## Install

```bash
npm install -D eslint-plugin-cooper
# typescript is required as a peer dependency
```

## Quick Start

```typescript
// eslint.config.ts
import cooper from 'eslint-plugin-cooper'

export default [
  ...cooper.zone({
    zones: ['src/domain/*'],
    aliases: { '@/': 'src/' },
  }),
]
```

This one call enables all 4 rules with the right `files` patterns:
- **Import rules** run on all source files
- **Barrel rules** run only on `index.ts` files within the zones

## Usage without `zone()`

Prefer manual control? Use standard ESLint flat config:

```typescript
import cooper from 'eslint-plugin-cooper'

export default [
  { plugins: { cooper } },
  {
    files: ['src/domain/**/index.ts'],
    rules: {
      'cooper/same-level-exports': 'error',
      'cooper/enforce-export-pattern': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'cooper/no-deep-imports': ['error', {
        zones: ['src/domain/*'],
        aliases: { '@/': 'src/' },
      }],
      'cooper/no-circular-imports': ['error', {
        aliases: { '@/': 'src/' },
      }],
    },
  },
]
```

## `cooper.zone()` options

```typescript
cooper.zone({
  zones: ['src/domain/*'],       // Required. '*' marks the barrel boundary
  aliases: { '@/': 'src/' },     // Path alias mappings
  extensions: ['.ts', '.tsx'],   // Default: ['.ts', '.tsx', '.js', '.jsx']
  barrelFileNames: ['index'],    // Default: ['index']
  sourceFiles: ['src/**/*.ts'],  // Default: auto-inferred from zones
  rules: {                       // Default: all 'error'
    'no-deep-imports': 'error',
    'same-level-exports': 'error',
    'enforce-export-pattern': 'error',
    'no-circular-imports': ['error', { maxDepth: 15 }],
  },
})
```

### Disabling a rule

```typescript
cooper.zone({
  zones: ['src/domain/*'],
  rules: { 'enforce-export-pattern': 'off' },
})
```

### Overriding per directory

```typescript
export default [
  ...cooper.zone({
    zones: ['src/domain/*', 'src/features/*'],
    aliases: { '@/': 'src/' },
  }),
  // Less strict for features
  {
    files: ['src/features/**/index.ts'],
    rules: { 'cooper/enforce-export-pattern': 'off' },
  },
  // Disable for tests
  {
    files: ['src/**/*.test.ts'],
    rules: {
      'cooper/no-deep-imports': 'off',
      'cooper/no-circular-imports': 'off',
    },
  },
]
```

## Rules

### `cooper/no-deep-imports`

Forces imports through barrel files instead of reaching into internal modules.

```
  import { Post } from '@/domain/posts'           // OK
  import { Post } from '@/domain/posts/entity'    // Error
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `zones` | `string[]` | `[]` | Protected directories. `*` = barrel boundary |
| `aliases` | `Record<string, string>` | `{}` | Path alias mappings |

---

### `cooper/same-level-exports`

Barrel files may only re-export from same-level files, not from subdirectories.

```typescript
// src/domain/posts/index.ts
export { Post } from './entity'           // OK
export { Rating } from './values/rating'  // Error
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extensions` | `string[]` | `['.ts', '.tsx', '.js', '.jsx']` | Barrel file extensions |
| `barrelFileNames` | `string[]` | `['index']` | Barrel file names |

---

### `cooper/enforce-export-pattern`

In barrel files: directories use `export *`, files use named exports.

```typescript
// src/domain/posts/index.ts
export { Post } from './entity'          // OK (file -> named)
export * from './value-objects'          // OK (directory -> star)

export * from './entity'                 // Error (file should use named)
export { Rating } from './value-objects' // Error (directory should use star)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extensions` | `string[]` | `['.ts', '.tsx', '.js', '.jsx']` | File extensions to resolve |
| `barrelFileNames` | `string[]` | `['index']` | Barrel file names |

---

### `cooper/no-circular-imports`

Detects circular imports by following the full import chain **through barrel re-exports**.
Type-only imports (`import type`) are ignored.

```
  posts/entity.ts → users/index.ts → users/entity.ts → posts/index.ts → posts/entity.ts
  ↑ cycle!
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `aliases` | `Record<string, string>` | `{}` | Path alias mappings |
| `extensions` | `string[]` | `['.ts', '.tsx', '.js', '.jsx']` | File extensions to resolve |
| `maxDepth` | `number` | `10` | Maximum recursion depth |

## Combining with Clean Architecture

Cooper handles barrel boundaries. For layer dependency rules, combine with [eslint-plugin-import-x](https://github.com/un-ts/eslint-plugin-import-x):

```typescript
import cooper from 'eslint-plugin-cooper'
import importPlugin from 'eslint-plugin-import-x'

export default [
  ...cooper.zone({
    zones: ['src/domain/*'],
    aliases: { '@/': 'src/' },
  }),
  {
    files: ['src/**/*.ts'],
    plugins: { 'import-x': importPlugin },
    rules: {
      'import-x/no-restricted-paths': ['error', {
        zones: [
          { target: './src/domain/**/*', from: './src/application/**/*' },
          { target: './src/domain/**/*', from: './src/infrastructure/**/*' },
          // ...
        ],
      }],
    },
  },
]
```

## Why "Cooper"?

A **cooper** is a craftsman who builds and repairs barrels. This plugin builds and guards your barrel exports.

## License

MIT
