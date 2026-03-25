# eslint-plugin-cooper

> The barrel craftsman for your codebase.

[![npm version](https://img.shields.io/npm/v/eslint-plugin-cooper.svg)](https://www.npmjs.com/package/eslint-plugin-cooper)
[![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-cooper.svg)](https://www.npmjs.com/package/eslint-plugin-cooper)
[![license](https://img.shields.io/npm/l/eslint-plugin-cooper.svg)](https://github.com/ryoyafukasawa/eslint-plugin-cooper/blob/main/LICENSE)

ESLint plugin that enforces barrel export boundaries and detects circular imports — including through barrel files (`index.ts`). Follows the full import chain through re-exports, catching circular dependencies that other tools miss.

## Install

```bash
npm install -D eslint-plugin-cooper
```

## Quick Start

```typescript
// eslint.config.ts
import cooper from 'eslint-plugin-cooper'

export default [
  cooper.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      'cooper/no-deep-imports': ['error', {
        zones: ['src/domain/*'],
        aliases: { '@/': 'src/' },
      }],
      'cooper/no-circular-imports': ['error', {
        aliases: { '@/': './src/' },
      }],
    },
  },
]
```

## Rules

### `cooper/no-deep-imports`

Disallow direct imports into protected directories. Forces barrel export (`index.ts`) usage.

```
  ✅ Pass                                  ❌ Fail
  ───────────────────────────────────────────────────────────────
  import { Post }                          import { Post }
    from '@/domain/posts'                    from '@/domain/posts/entity'
                                             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                             Direct import into
                                             "@/domain/posts/entity".
                                             Import from "@/domain/posts"
                                             instead.
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `zones` | `string[]` | `[]` | Glob-like patterns for protected directories. `*` represents the barrel boundary. |
| `aliases` | `Record<string, string>` | `{}` | Path alias mappings (e.g. `{ '@/': 'src/' }`) |

<details>
<summary>Example: multiple zones</summary>

```typescript
'cooper/no-deep-imports': ['error', {
  zones: [
    'src/domain/*',     // Protect domain layer
    'src/features/*',   // Protect feature modules
    'src/shared/*',     // Protect shared modules
  ],
  aliases: { '@/': 'src/' },
}]
```

</details>

---

### `cooper/same-level-exports`

Barrel files (`index.ts`) may only re-export from same-level files.

```
  // src/domain/posts/index.ts

  ✅ Pass                                  ❌ Fail
  ───────────────────────────────────────────────────────────────
  export { Post }                          export { Rating }
    from './entity'                          from './values/rating'
                                             ~~~~~~~~~~~~~~~~~~~~~~
  export type { PostRepo }                   Barrel file cannot export
    from './repo'                            from "./values/rating".
                                             Only same-level files
                                             are allowed.
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extensions` | `string[]` | `['.ts', '.tsx', '.js', '.jsx']` | File extensions to recognize as barrel files (`index.*`) |

---

### `cooper/enforce-export-pattern`

In barrel files, directories must use `export *`, files must use named exports.

```
  // src/domain/posts/index.ts

  ✅ Pass                                  ❌ Fail
  ───────────────────────────────────────────────────────────────
  export { Post }                          export * from './entity'
    from './entity'                        ~~~~~~~~~~~~~~~~~~~~~~~~
                                           Use "export { ... } from
  export *                                 './entity'". Files should
    from './value-objects'                 use named exports.

                                           export { Rating }
                                             from './value-objects'
                                           ~~~~~~~~~~~~~~~~~~~~~~~~
                                           Use "export * from
                                           './value-objects'".
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extensions` | `string[]` | `['.ts', '.tsx', '.js', '.jsx']` | File extensions to resolve |

---

### `cooper/no-circular-imports`

Detect circular import dependencies by following the full import chain, **including through barrel files**.

```
  ❌ Circular import detected:

  posts/entity.ts
       ↓ import { User } from '@/domain/users'
  users/index.ts
       ↓ export { User } from './entity'
  users/entity.ts
       ↓ import { Post } from '@/domain/posts'
  posts/index.ts
       ↓ export { Post } from './entity'
  posts/entity.ts  ← cycle!
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `aliases` | `Record<string, string>` | `{}` | Path alias mappings (e.g. `{ '@/': './src/' }`) |
| `extensions` | `string[]` | `['.ts', '.tsx', '.js', '.jsx']` | File extensions to resolve |
| `maxDepth` | `number` | `10` | Maximum recursion depth |

## Configs

### `cooper.configs.recommended`

Enables all project-agnostic rules at error level:

- `cooper/same-level-exports`
- `cooper/enforce-export-pattern`
- `cooper/no-circular-imports`

`no-deep-imports` is **not** included because it requires project-specific `zones` configuration.

## Why "Cooper"?

A **cooper** is a craftsman who builds and repairs barrels. This plugin builds and guards your barrel exports.

## License

MIT
