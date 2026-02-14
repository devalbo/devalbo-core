# devalbo-core-v2

Monorepo for the foundational `@devalbo/*` packages and the `naveditor` PoC.

## Workspace Packages

- `@devalbo/shared`: shared types, environment detection, validation errors
- `@devalbo/filesystem`: filesystem drivers and watcher services
- `@devalbo/state`: TinyBase-backed state and persister wrappers
- `@devalbo/ui`: isomorphic UI primitives and shell providers
- `@devalbo/commands`: command registry, parsing, validation, console bridge
- `@devalbo/worker-bridge`: worker messaging and shared-buffer helpers
- `naveditor`: terminal/browser navigator-editor app built on these packages

## Quick Start

```bash
pnpm install
pnpm -r --filter "@devalbo/*" build
pnpm -r --filter "@devalbo/*" type-check
pnpm test:packages
```

## All Workspace Commands

```bash
pnpm build
pnpm type-check
pnpm test
```

## Examples

See `examples/` for package-level usage snippets.
