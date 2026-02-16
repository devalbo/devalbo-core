# Migration Plan: Branded Types Package

Extract the generic branded type infrastructure from `@brute-force-games/bfg-engine` into a new `@devalbo/branded-types` package in this monorepo.

## Scope

**In scope:**
- New `@devalbo/branded-types` package with core infrastructure, three key methodologies (UUID, NumberIndex, Hash), branded numeric helpers, and branded string utilities
- Full test suite using vitest
- Integration with `@devalbo/shared` (update existing branded types to use new package)
- Validation examples: a small set of cross-cutting unit-typed metric values (mass, length, temperature) implemented at the end to verify the infrastructure supports the `@devalbo/branded-units` use case without issues (see Phase 8)

**Out of scope (follow-on work):**
- Full `@devalbo/branded-units` package with all ~160 units, SI prefix system, and comprehensive conversions — see `UNITS_BRAND_IMPL.md`
- Domain-specific toolbox instances — consuming packages define their own prefixes and toolboxes

## Source Inventory (bfg-starter)

All source files live in `modules/bfg-engine/src/models/types/`.

### Generic infrastructure (to extract)

| Source File | Purpose |
|---|---|
| `prefix-key-methods.ts` | Base brand constants (`BfgIdTypePrefixBrandKey`, `BfgIdTypeKeyMethodBrandKey`), Zod brand schemas |
| `branded-prefix-key-str.ts` | Core toolbox factory (`createBfgBrandedPrefixKeyStringToolbox`), `IKeyMethodology` / `IBfgBrandedPrefixKeyStringToolbox` interfaces, schema creation, validation helpers |
| `branded-uuids.ts` | UUID key methodology factory (`createBfgBrandedUuidToolbox`), UUID regex, `generateUuidKey` |
| `branded-ids.ts` | Number index key methodology factory (`createBfgBrandedNumberIndexToolbox`), number regex, key generator |
| `bfg-branded-string-utils.ts` | Simple branded string toolbox (`createBfgBrandedStringToolbox`, `createBfgBrandedStringToolboxForSchema`) |
| `bfg-versions.ts` | Pattern for branded numeric types (`BfgGameRoomVersionIndex`, `BfgTimestamp`, etc.) |

### Domain-specific (NOT extracted — remain in consuming packages)

| Source File | Purpose |
|---|---|
| `bfg-uuid-prefixes.ts` | BFG-specific UUID prefix constants (e.g., `bfg_game`, `bfg_game_table`) |
| `bfg-id-prefixes.ts` | BFG-specific number index prefix constants (e.g., `p` for player seat) |
| `bfg-branded-uuids.ts` | Concrete UUID toolbox instances (e.g., `BfgGameInstanceIdToolbox`) |
| `bfg-branded-ids.ts` | Concrete number index toolbox instances (e.g., `BfgGameTableSeatIdToolbox`) |
| `bfg-branded-string-types.ts` | Concrete branded string instances |

## Target State

### Existing `@devalbo/shared` branded types

`packages/shared/src/types/branded.ts` currently has:
- Basic `Branded<T, B>` type using unique symbol
- `FilePath`, `DirectoryPath` types
- Unsafe-only constructors (`asFilePath`, `asDirectoryPath`)
- No Zod integration, no validation, no toolbox pattern

This will be updated to consume from `@devalbo/branded-types`.

### New package: `@devalbo/branded-types`

```
packages/branded-types/
├── src/
│   ├── index.ts                        # Public API exports
│   ├── core/
│   │   ├── brand-types.ts              # Base brand constants & Zod schemas
│   │   ├── prefix-key-string.ts        # Core toolbox factory, interfaces, helpers
│   │   └── branded-string.ts           # Simple branded string utilities
│   ├── methodologies/
│   │   ├── uuid-key.ts                 # UUID key methodology
│   │   ├── number-index-key.ts         # Number index key methodology
│   │   └── hash-key.ts                 # Hash key methodology (NEW — not in bfg-starter)
│   └── numeric/
│       └── branded-number.ts           # Branded numeric type helpers
├── tests/
│   ├── prefix-key-string.test.ts       # Core toolbox tests
│   ├── uuid-key.test.ts                # UUID methodology tests
│   ├── number-index-key.test.ts        # Number index methodology tests
│   ├── hash-key.test.ts                # Hash key methodology tests
│   ├── branded-string.test.ts          # Branded string tests
│   ├── branded-number.test.ts          # Branded number tests
│   └── compile-time.test.ts            # @ts-expect-error misuse tests
├── package.json
├── tsconfig.json
└── README.md
```

## Renaming Strategy

All `Bfg` prefixes become generic names. The package should be domain-agnostic.

| bfg-starter Name | @devalbo/branded-types Name |
|---|---|
| `BfgIdTypePrefixBrand` | `IdTypePrefixBrand` |
| `BfgIdTypeKeyMethodBrand` | `IdTypeKeyMethodBrand` |
| `BfgIdTypePrefixBrandKey` | `IdTypePrefixBrandKey` |
| `BfgIdTypeKeyMethodBrandKey` | `IdTypeKeyMethodBrandKey` |
| `IKeyMethodology` | `IKeyMethodology` (unchanged) |
| `IBfgBrandedPrefixKeyStringToolbox` | `IBrandedPrefixKeyStringToolbox` |
| `BrandedPrefixKeyString` | `BrandedPrefixKeyString` (unchanged) |
| `BrandedPrefixKeyStringSchema` | `BrandedPrefixKeyStringSchema` (unchanged) |
| `createBfgBrandedPrefixKeyStringToolbox` | `createBrandedPrefixKeyStringToolbox` (separator moved from methodology to factory parameter) |
| `createRawBrandedPrefixKeyStringSchema` | `createBrandedPrefixKeyStringSchema` |
| `createBrandedPrefixKeyStringValue` | `createBrandedPrefixKeyStringValue` (unchanged) |
| `createValidatedBrandedPrefixKeyStringValue` | `assertBrandedPrefixKeyStringValue` |
| `parseBrandedPrefixKeyStringValueFromSchema` | `parseBrandedPrefixKeyStringValue` |
| `isValidBrandedPrefixKeyStringValue` | `isValidBrandedPrefixKeyStringValue` (unchanged) |
| `createBfgBrandedUuidToolbox` | `createBrandedUuidToolbox` |
| `BfgUuidMethodKeyValue` | `UuidKeyValue` |
| `BfgUuidPrefixType` | `UuidPrefixType` |
| `BfgUuidBrand` | (generic — consuming packages define their own union type) |
| `createBfgBrandedNumberIndexToolbox` | `createBrandedNumberIndexToolbox` |
| `BfgNumberIndexMethodType` | `NumberIndexKeyValue` |
| `BfgNumberIndexPrefixType` | `NumberIndexPrefixType` |
| `createBfgBrandedStringToolbox` | `createBrandedStringToolbox` |
| `createBfgBrandedStringToolboxForSchema` | `createBrandedStringToolboxForSchema` |
| `IBfgBrandedStringToolbox` | `IBrandedStringToolbox` |
| `IBfgBrandedStringToolboxForSchema` | `IBrandedStringToolboxForSchema` |
| `RegexableString` | `RegexableString` (unchanged — kept as a reusable branded string type for regex patterns, useful for future branded implementations) |

## API Changes from bfg-starter

### 1. Add `assertId` to toolbox interface

The bfg-starter toolbox has `createValidatedId` (throws) and `parseId` (also throws via `schema.parse`). Both throw, which is inconsistent with the BRANDED_TYPES.md convention.

**Simplified `IKeyMethodology` (separator removed):**

The bfg-starter `IKeyMethodology` had `separatorStr` as a field. This is removed — the separator is now solely a factory concern, not part of the methodology definition. This keeps methodologies focused on key format and generation, while the factory handles assembly.

```ts
export interface IKeyMethodology<
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
> {
  idPrefix: P;
  createIdPrefixRegexStr: (idPrefix: P) => RegexableString;
  keyRegexStr: RegexableString;
  generateRandomKey?: () => KM;  // optional — not all methodologies support random generation
}
```

**New toolbox interface:**

```ts
export interface IBrandedPrefixKeyStringToolbox<
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
> {
  idSchema: BrandedPrefixKeyStringSchema<P, KM>;
  idPrefix: P;
  separator: string;
  keyMethodology: IKeyMethodology<P, KM>;

  // Construction (optional — not all methodologies support random generation)
  createRandomId?: () => BrandedPrefixKeyString<P, KM>;
  createIdForKey: (key: KM) => BrandedPrefixKeyString<P, KM>;

  // Validation (two variants per BRANDED_TYPES.md)
  parseId: (id: string) => z.SafeParseReturnType<string, BrandedPrefixKeyString<P, KM>>;
  assertId: (id: string) => BrandedPrefixKeyString<P, KM>;  // throws on invalid
}
```

**Base factory with required separator:**

```ts
// The base factory — separator is a required input, separate from the methodology
export const createBrandedPrefixKeyStringToolbox = <
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
>(
  keyMethodology: IKeyMethodology<P, KM>,
  separator: string,
): IBrandedPrefixKeyStringToolbox<P, KM>;

// Convenience factories implemented in terms of the base:
export const createBrandedUuidToolbox = (idPrefix, separator = "_") =>
  createBrandedPrefixKeyStringToolbox(uuidMethodology(idPrefix), separator);

export const createBrandedNumberIndexToolbox = (idPrefix, separator = "") =>
  createBrandedPrefixKeyStringToolbox(numberIndexMethodology(idPrefix), separator);

export const createBrandedHashToolbox = (idPrefix, options: { hashLength: number; separator?: string }) =>
  createBrandedPrefixKeyStringToolbox(hashMethodology(idPrefix, options), options.separator ?? "_");
```

**Changes from bfg-starter:**
- `separatorStr` removed from `IKeyMethodology` — separator is now a factory parameter only
- `generateRandomKey` made optional on `IKeyMethodology` (hash methodology does not support it)
- `parseId` now returns `SafeParseReturnType` (was throwing via `schema.parse`)
- `assertId` replaces `createValidatedId` (clearer intent naming)
- `createValidatedId` is removed (redundant with `assertId`)
- `createRandomId` is optional on toolbox (derived from `generateRandomKey` presence)
- Base factory name simplified: `createBrandedPrefixKeyStringToolbox` (no `WithSeparator` suffix — separator is always required)

### 2. Add hash key methodology (NEW — validate only)

bfg-starter only has UUID and NumberIndex. Add HashKey per BRANDED_TYPES.md. Hash keys are derived from input data, not randomly generated — use UUID methodology if you need random IDs.

```ts
// methodologies/hash-key.ts
export const HashKeyBrandKey = "hash-methodology" as const;
export const HashKeyValueSchema = IdTypeKeyMethodBrandSchema.brand(HashKeyBrandKey);
export type HashKeyValue = z.infer<typeof HashKeyValueSchema>;

export const createBrandedHashToolbox = <T extends HashPrefixType>(
  idPrefix: T,
  options: { hashLength: number; separator?: string }
): IBrandedPrefixKeyStringToolbox<HashPrefixType, HashKeyValue>;
// NOTE: createRandomId is NOT provided on this toolbox.
// Only createIdForKey (for pre-computed hashes), parseId, and assertId are available.
```

### 3. Add branded numeric helpers (NEW)

bfg-starter defines branded numbers inline. Provide reusable helpers:

```ts
// numeric/branded-number.ts
export const createBrandedIntSchema = <B extends string>(brand: B) =>
  z.number().int().brand<B>();

export const createBrandedNonNegativeIntSchema = <B extends string>(brand: B) =>
  z.number().int().nonnegative().brand<B>();

export const createBrandedFiniteNumberSchema = <B extends string>(brand: B) =>
  z.number().finite().brand<B>();
```

Consuming packages then do:

```ts
const MillisecondsSchema = createBrandedNonNegativeIntSchema('Milliseconds');
type Milliseconds = z.infer<typeof MillisecondsSchema>;
```

## Implementation Steps

### Phase 1: Scaffold the package

1. Create `packages/branded-types/` directory structure
2. Create `package.json`:
   - name: `@devalbo/branded-types`
   - version: `0.1.0`
   - type: `module`
   - dependencies: `zod: ^4.3.6`
   - follows existing `@devalbo/*` package conventions
3. Create `tsconfig.json` extending `../../tsconfig.base.json`
4. Register in `pnpm-workspace.yaml` (already covered — `packages/*` glob)

### Phase 2: Port core infrastructure

1. **`src/core/brand-types.ts`** — Port from `prefix-key-methods.ts`
   - Rename `BfgIdTypePrefixBrandKey` → `IdTypePrefixBrandKey`
   - Rename `BfgIdTypeKeyMethodBrandKey` → `IdTypeKeyMethodBrandKey`
   - Rename schemas and types accordingly
   - Remove commented-out code

2. **`src/core/prefix-key-string.ts`** — Port from `branded-prefix-key-str.ts`

   This is the most complex step. Break into sub-steps:

   **2a. Port and simplify `IKeyMethodology` interface**
   - Remove `separatorStr` from the interface (separator is now factory-only)
   - Make `generateRandomKey` optional (not all methodologies support it)
   - Rename all `Bfg` prefixes
   - Keep `RegexableString` branded type as-is (useful for future branded implementations)

   **2b. Port and update `IBrandedPrefixKeyStringToolbox` interface**
   - Add `separator: string` as a read-only field on the toolbox
   - Make `createRandomId` optional (derived from `generateRandomKey` presence)
   - Change `parseId` signature to return `SafeParseReturnType`
   - Add `assertId` signature (throws on invalid)
   - Remove `createValidatedId`
   - Rename all `Bfg` prefixes

   **2c. Port schema creation**
   - Rename `createRawBrandedPrefixKeyStringSchema` → `createBrandedPrefixKeyStringSchema`
   - Update to accept separator as a parameter instead of reading from methodology
   - Port `BrandedPrefixKeyStringSchema` and `BrandedPrefixKeyString` types

   **2d. Implement base factory**
   - Implement `createBrandedPrefixKeyStringToolbox(keyMethodology, separator)` as the single factory
   - Wire `createRandomId` to only be present when `generateRandomKey` exists on the methodology
   - Wire `parseId` to use `schema.safeParse` internally
   - Wire `assertId` to use `schema.parse` internally (throws on invalid)
   - Wire `createIdForKey` to construct `prefix + separator + key`

   **2e. Port helper functions**
   - Port `createBrandedPrefixKeyStringValue` (update to accept separator parameter)
   - Port `isValidBrandedPrefixKeyStringValue` type guard
   - Rename `createValidatedBrandedPrefixKeyStringValue` → `assertBrandedPrefixKeyStringValue`
   - Rename `parseBrandedPrefixKeyStringValueFromSchema` → `parseBrandedPrefixKeyStringValue` (use `safeParse` internally)
   - Remove commented-out code

3. **`src/core/branded-string.ts`** — Port from `bfg-branded-string-utils.ts`
   - Rename `BfgBrandedString*` → `BrandedString*`
   - Rename `createBfgBrandedStringToolbox` → `createBrandedStringToolbox`
   - Rename `createBfgBrandedStringToolboxForSchema` → `createBrandedStringToolboxForSchema`
   - Clean up interface types

### Phase 3: Port key methodologies

4. **`src/methodologies/uuid-key.ts`** — Port from `branded-uuids.ts`
   - Rename `BfgUuidMethodKeyValue` → `UuidKeyValue`
   - Rename `createBfgBrandedUuidToolbox` → `createBrandedUuidToolbox`
   - Define `uuidMethodology(idPrefix)` helper that returns an `IKeyMethodology` with UUID regex and `crypto.randomUUID()` as `generateRandomKey`
   - Implement as convenience wrapper: calls `createBrandedPrefixKeyStringToolbox(uuidMethodology(idPrefix), separator)` with default separator `"_"`
   - `createRandomId` is provided (UUID supports random generation via `generateRandomKey`)

5. **`src/methodologies/number-index-key.ts`** — Port from `branded-ids.ts`
   - Rename `BfgNumberIndexMethodType` → `NumberIndexKeyValue`
   - Rename `createBfgBrandedNumberIndexToolbox` → `createBrandedNumberIndexToolbox`
   - Define `numberIndexMethodology(idPrefix)` helper that returns an `IKeyMethodology` with numeric regex and random number as `generateRandomKey`
   - Implement as convenience wrapper: calls `createBrandedPrefixKeyStringToolbox(numberIndexMethodology(idPrefix), separator)` with default separator `""`
   - `createRandomId` is provided (number index supports random generation via `generateRandomKey`)
   - Remove commented-out code

6. **`src/methodologies/hash-key.ts`** — NEW implementation
   - Define `HashKeyValue` type
   - Define `hashMethodology(idPrefix, options)` helper that returns an `IKeyMethodology` with hex regex for configured length and NO `generateRandomKey`
   - Implement `createBrandedHashToolbox` as convenience wrapper: calls `createBrandedPrefixKeyStringToolbox(hashMethodology(idPrefix, options), separator)` with default separator `"_"`
   - Accept configurable hash length (default 8)
   - Validate hex format via regex
   - `createRandomId` is NOT present on the returned toolbox (no `generateRandomKey` on methodology)
   - Only exposes `createIdForKey`, `parseId`, `assertId`

### Phase 4: Add branded numeric helpers

7. **`src/numeric/branded-number.ts`** — NEW (pattern from `bfg-versions.ts`)
   - `createBrandedIntSchema`
   - `createBrandedNonNegativeIntSchema`
   - `createBrandedFiniteNumberSchema`
   - `createBrandedPositiveIntSchema`
   - Unsafe cast helpers: `unsafeAs<BrandName>`-style generic
   - Conversion helper pattern documentation

### Phase 5: Exports and index

8. **`src/index.ts`** — Public API surface
   - Export all types, interfaces, factories, and helpers
   - Organize re-exports by category (core, methodologies, numeric)
   - Ensure consuming packages only need `import { ... } from '@devalbo/branded-types'`

### Phase 6: Tests

Test runner: **vitest**. Test comprehensively — every methodology, every constructor tier, every edge case.

9. **`tests/prefix-key-string.test.ts`** — Core toolbox factory
   - Schema creation and regex validation
   - Toolbox creation with explicit separator
   - `createRandomId` returns valid branded IDs (when provided)
   - `createIdForKey` deterministic output
   - `parseId` returns SafeParseReturnType on success
   - `parseId` returns SafeParseReturnType on failure (wrong prefix, wrong key format, empty string, extra characters)
   - `assertId` throws on invalid input (wrong prefix, malformed key, empty, null-ish)
   - `assertId` returns valid branded value on valid input
   - `isValidBrandedPrefixKeyStringValue` type guard (true and false cases)
   - Edge cases: empty prefix, very long keys, special characters in separator

10. **`tests/uuid-key.test.ts`** — UUID methodology
    - UUID format validation (valid v4 UUIDs)
    - Rejects non-v4 UUIDs, truncated UUIDs, UUIDs with wrong case
    - Random UUID generation produces unique values
    - Custom separator: `createBrandedUuidToolbox(prefix, "-")` vs default `"_"`
    - Roundtrip: `createRandomId` → `parseId` → success
    - Roundtrip: `createRandomId` → `assertId` → returns same value
    - Roundtrip: `createIdForKey` → `parseId` → success, data matches
    - Cross-prefix rejection: UUID toolbox for prefix A rejects IDs with prefix B

11. **`tests/number-index-key.test.ts`** — Number index methodology
    - Accepts valid numeric keys (0, 1, 42, 9999999)
    - Rejects non-numeric keys (letters, symbols, floats, negative)
    - Random key generation produces valid values
    - Custom separator: with and without separator
    - Roundtrip: create → parse → assert
    - Cross-prefix rejection

12. **`tests/hash-key.test.ts`** — Hash key methodology
    - Accepts valid hex strings of configured length
    - Rejects wrong-length hashes, non-hex characters
    - Configurable hash length: 8, 16, 32
    - Custom separator
    - `createRandomId` is NOT available (verify undefined or not on toolbox)
    - `createIdForKey` with pre-computed hash
    - Roundtrip: `createIdForKey` → `parseId` → success
    - Cross-prefix rejection

13. **`tests/branded-string.test.ts`** — Branded strings
    - Simple branded string creation and validation
    - Schema-based branded string creation
    - Hydration from serialized string
    - Schema description requirement enforcement

14. **`tests/branded-number.test.ts`** — Branded numbers
    - `createBrandedIntSchema`: accepts integers, rejects floats/NaN/Infinity
    - `createBrandedNonNegativeIntSchema`: accepts 0 and positive, rejects negative
    - `createBrandedFiniteNumberSchema`: accepts finite, rejects Infinity/-Infinity/NaN
    - `createBrandedPositiveIntSchema`: accepts positive, rejects 0 and negative
    - safeParse and parse behavior for each
    - Edge cases: Number.MAX_SAFE_INTEGER, -0, very small floats

15. **`tests/compile-time.test.ts`** — Type safety
    - `@ts-expect-error` tests for cross-domain ID misuse (e.g., GameId where SeatId expected)
    - `@ts-expect-error` tests for cross-methodology misuse (e.g., UUID ID where NumberIndex ID expected)
    - `@ts-expect-error` tests for branded number misuse (e.g., Milliseconds where Seconds expected)
    - `@ts-expect-error` tests for plain string where branded string expected
    - `@ts-expect-error` tests for plain number where branded number expected
    - Verify branded values ARE assignable to their base type (string/number) when needed

### Phase 7: Integrate with `@devalbo/shared`

16. Add `@devalbo/branded-types` as dependency of `@devalbo/shared`
17. Update `packages/shared/src/types/branded.ts`:
    - Keep `Branded<T, B>` generic (lightweight cases without Zod stay as-is)
    - Add Zod-backed branded constructors for `FilePath`, `DirectoryPath`
    - Wire up `parseFilePath` / `assertFilePath` using `@devalbo/branded-types` patterns
    - Rename bare `asFilePath` → `unsafeAsFilePath`, `asDirectoryPath` → `unsafeAsDirectoryPath`
    - Keep old names as deprecated re-exports for backward compatibility during migration
18. Verify no breakage in downstream packages (`@devalbo/commands`, `@devalbo/filesystem`, `@devalbo/state`, `@devalbo/ui`)

### Phase 8: Validate with cross-cutting unit-typed metric values

After all infrastructure is built and tested, implement a small set of metric value examples as a validation exercise. The goal is to confirm the base factory and toolbox pattern works cleanly for unit-typed measurements — catching any design friction before the full `@devalbo/branded-units` package is built.

19. **`src/examples/metric-values.ts`** (or `tests/metric-values.test.ts` — test-only is fine)

    Implement using only the public API of `@devalbo/branded-types`:

    **a. NumericValueKey methodology helper**
    - Create `createNumericValueMethodology(prefix, options?)` that returns an `IKeyMethodology` with decimal number regex
    - Options: `allowNegative` (default true)
    - No `generateRandomKey` (metric values are not random)

    **b. Mass: `kg` and `lb` (one metric, one US customary)**
    - Define toolboxes via `createBrandedPrefixKeyStringToolbox(methodology, "_")`
    - `createValue(n)` helper (wraps `createIdForKey`)
    - `extractNumber(v)` helper (splits on separator, parses float)
    - Conversion: `kilogramsToPounds` and `poundsToKilograms`
    - Tests: construction, parse, assert, conversion roundtrip, compile-time misuse (`@ts-expect-error`)
    - Note: Only one unit per system (kg, lb). Ignore sub-unit prefixes (mg, g, oz) for now.

    **c. Length: `m` and `ft` (one metric, one US customary)**
    - Same pattern as mass
    - Conversion: `metersToFeet` and `feetToMeters`
    - Tests: construction, parse, assert, conversion roundtrip, compile-time misuse
    - Note: Only one unit per system (m, ft). Ignore sub-unit prefixes (mm, cm, km, in, yd, mi) for now.

    **d. Temperature: `degC`, `degF`, `K` (non-linear conversions)**
    - Celsius and Fahrenheit allow negative; Kelvin does not (`allowNegative: false`)
    - Conversions: `celsiusToFahrenheit`, `fahrenheitToCelsius`, `celsiusToKelvin`, `kelvinToCelsius`
    - Composed conversion: `fahrenheitToKelvin` chains through Celsius
    - Tests: construction, parse, assert, conversion accuracy, negative value handling, Kelvin rejects negative, compile-time misuse
    - Note: Temperature doesn't have sub-unit prefixes, so all three scales are included.

    **What this validates:**
    - The base factory supports non-ID use cases (numeric value keys)
    - `IKeyMethodology` without `generateRandomKey` works correctly (no `createRandomId` on toolbox)
    - Custom methodology definitions plug in cleanly via public API
    - Cross-prefix type safety holds for unit-typed values
    - Separator handling works for non-ID prefixes
    - The pattern is ergonomic enough to scale to the full `@devalbo/branded-units` package

    **If friction is found:** Document it. Adjust the core infrastructure before the full units package is built — this is the point of doing this validation.

## Dependencies

| Dependency | Version | Type | Reason |
|---|---|---|---|
| `zod` | `^4.3.6` | runtime | Schema validation, `.brand()`, `.safeParse()` |
| `vitest` | latest | devDependency | Test runner |

No other runtime dependencies. The package should be minimal.

---

## Appendix: Branded Metric Value Examples (out of scope — future work)

> **These examples are reference material for Phase 8 and the future `@devalbo/branded-units` package.** Phase 8 implements a subset of these (mass, length, temperature) as a validation exercise. The full unit inventory is covered in `UNITS_BRAND_IMPL.md`.

### Mass (Metric + US Customary)

```ts
import { z } from 'zod';
import { createBrandedPrefixKeyStringToolbox, type IKeyMethodology, type RegexableString } from '@devalbo/branded-types';

// --- NumericValueKey methodology (shared across all metric value types) ---

const NumericValueRegex = "-?[0-9]+(\\.[0-9]+)?" as RegexableString;
const NonNegativeNumericValueRegex = "[0-9]+(\\.[0-9]+)?" as RegexableString;

const createNumericValueMethodology = <P extends string>(
  prefix: P,
  options?: { allowNegative?: boolean }
) => ({
  idPrefix: prefix,
  createIdPrefixRegexStr: (p: P) => p as unknown as RegexableString,
  separatorStr: "_" as RegexableString,
  keyRegexStr: (options?.allowNegative !== false ? NumericValueRegex : NonNegativeNumericValueRegex),
  generateRandomKey: () => { throw new Error('Metric values are not randomly generated'); },
});

// --- Type definitions ---

const KilogramsPrefix = "kg" as const;
const GramsPrefix = "g" as const;
const PoundsPrefix = "lb" as const;
const OuncesPrefix = "oz" as const;

const KilogramsToolbox = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(KilogramsPrefix, { allowNegative: false }),
  "_",
);
const GramsToolbox = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(GramsPrefix, { allowNegative: false }),
  "_",
);
const PoundsToolbox = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(PoundsPrefix, { allowNegative: false }),
  "_",
);
const OuncesToolbox = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(OuncesPrefix, { allowNegative: false }),
  "_",
);

type KilogramsValue = typeof KilogramsToolbox extends { idSchema: z.ZodType<infer T> } ? T : never;
type GramsValue = typeof GramsToolbox extends { idSchema: z.ZodType<infer T> } ? T : never;
type PoundsValue = typeof PoundsToolbox extends { idSchema: z.ZodType<infer T> } ? T : never;
type OuncesValue = typeof OuncesToolbox extends { idSchema: z.ZodType<infer T> } ? T : never;

// --- Construction ---

function createKg(n: number): KilogramsValue {
  return KilogramsToolbox.createIdForKey(`${n}` as any);  // produces "kg_82.5"
}
function createLb(n: number): PoundsValue {
  return PoundsToolbox.createIdForKey(`${n}` as any);     // produces "lb_165.3"
}

// --- Extraction ---

function extractNumber(v: string): number {
  const sep = v.indexOf('_');
  return parseFloat(v.slice(sep + 1));
}

// --- Conversions (typed) ---

function kilogramsToPounds(v: KilogramsValue): PoundsValue {
  const kg = extractNumber(v);
  return createLb(+(kg * 2.20462).toFixed(6));
}
function poundsToKilograms(v: PoundsValue): KilogramsValue {
  const lb = extractNumber(v);
  return createKg(+(lb / 2.20462).toFixed(6));
}
function kilogramsToGrams(v: KilogramsValue): GramsValue {
  const kg = extractNumber(v);
  return GramsToolbox.createIdForKey(`${kg * 1000}` as any);
}
function poundsToOunces(v: PoundsValue): OuncesValue {
  const lb = extractNumber(v);
  return OuncesToolbox.createIdForKey(`${lb * 16}` as any);
}

// --- Usage ---

const myWeight: KilogramsValue = createKg(82.5);           // "kg_82.5"
const inPounds: PoundsValue = kilogramsToPounds(myWeight);  // "lb_181.880... "
const inGrams: GramsValue = kilogramsToGrams(myWeight);     // "g_82500"

// Validation from untrusted input
const parsed = KilogramsToolbox.parseId("kg_75.0");         // SafeParseReturnType
const asserted = PoundsToolbox.assertId("lb_165.3");        // throws if invalid

// Compile-time safety
declare function setWeight(w: KilogramsValue): void;
setWeight(myWeight);    // ok
// @ts-expect-error — PoundsValue is not KilogramsValue
setWeight(inPounds);
```

### Length (Metric + US Customary)

```ts
const MillimetersPrefix = "mm" as const;
const CentimetersPrefix = "cm" as const;
const MetersPrefix = "m" as const;
const KilometersPrefix = "km" as const;
const InchesPrefix = "in" as const;
const FeetPrefix = "ft" as const;
const YardsPrefix = "yd" as const;
const MilesPrefix = "mi" as const;

const Millimeters = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(MillimetersPrefix), "_",
);
const Centimeters = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(CentimetersPrefix), "_",
);
const Meters = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(MetersPrefix), "_",
);
const Kilometers = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(KilometersPrefix), "_",
);
const Inches = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(InchesPrefix), "_",
);
const Feet = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(FeetPrefix), "_",
);
const Yards = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(YardsPrefix), "_",
);
const Miles = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(MilesPrefix), "_",
);

type MillimetersValue = typeof Millimeters extends { idSchema: z.ZodType<infer T> } ? T : never;
type CentimetersValue = typeof Centimeters extends { idSchema: z.ZodType<infer T> } ? T : never;
type MetersValue = typeof Meters extends { idSchema: z.ZodType<infer T> } ? T : never;
type KilometersValue = typeof Kilometers extends { idSchema: z.ZodType<infer T> } ? T : never;
type InchesValue = typeof Inches extends { idSchema: z.ZodType<infer T> } ? T : never;
type FeetValue = typeof Feet extends { idSchema: z.ZodType<infer T> } ? T : never;
type YardsValue = typeof Yards extends { idSchema: z.ZodType<infer T> } ? T : never;
type MilesValue = typeof Miles extends { idSchema: z.ZodType<infer T> } ? T : never;

// --- Construction helpers ---

const createMm = (n: number): MillimetersValue => Millimeters.createIdForKey(`${n}` as any);
const createCm = (n: number): CentimetersValue => Centimeters.createIdForKey(`${n}` as any);
const createM = (n: number): MetersValue => Meters.createIdForKey(`${n}` as any);
const createKm = (n: number): KilometersValue => Kilometers.createIdForKey(`${n}` as any);
const createIn = (n: number): InchesValue => Inches.createIdForKey(`${n}` as any);
const createFt = (n: number): FeetValue => Feet.createIdForKey(`${n}` as any);

// --- Metric ↔ US conversions ---

function inchesToCentimeters(v: InchesValue): CentimetersValue {
  return createCm(+(extractNumber(v) * 2.54).toFixed(6));
}
function centimetersToInches(v: CentimetersValue): InchesValue {
  return createIn(+(extractNumber(v) / 2.54).toFixed(6));
}
function feetToMeters(v: FeetValue): MetersValue {
  return createM(+(extractNumber(v) * 0.3048).toFixed(6));
}
function metersToFeet(v: MetersValue): FeetValue {
  return createFt(+(extractNumber(v) / 0.3048).toFixed(6));
}

// --- Metric internal conversions ---

function metersToKilometers(v: MetersValue): KilometersValue {
  return createKm(extractNumber(v) / 1000);
}
function kilometersToMeters(v: KilometersValue): MetersValue {
  return createM(extractNumber(v) * 1000);
}
function centimetersToMillimeters(v: CentimetersValue): MillimetersValue {
  return createMm(extractNumber(v) * 10);
}

// --- Usage ---

const height: CentimetersValue = createCm(182.5);            // "cm_182.5"
const heightIn: InchesValue = centimetersToInches(height);    // "in_71.850393"
const marathon: KilometersValue = createKm(42.195);           // "km_42.195"
const marathonM: MetersValue = kilometersToMeters(marathon);  // "m_42195"

// Validation
const parsed = Meters.parseId("m_100");                       // SafeParseReturnType
const invalid = Feet.parseId("ft_abc");                       // { success: false, ... }

// Compile-time safety
declare function setAltitude(a: MetersValue): void;
setAltitude(marathonM);  // ok
// @ts-expect-error — FeetValue is not MetersValue
setAltitude(heightIn);
// @ts-expect-error — KilometersValue is not MetersValue
setAltitude(marathon);
```

### Temperature (non-linear conversions)

Temperature is special: conversions are non-linear (offset + scale), not just multiplication.

```ts
const CelsiusPrefix = "degC" as const;
const FahrenheitPrefix = "degF" as const;
const KelvinPrefix = "K" as const;

const Celsius = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(CelsiusPrefix, { allowNegative: true }),
  "_",
);
const Fahrenheit = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(FahrenheitPrefix, { allowNegative: true }),
  "_",
);
const Kelvin = createBrandedPrefixKeyStringToolbox(
  createNumericValueMethodology(KelvinPrefix, { allowNegative: false }),  // Kelvin can't be negative
  "_",
);

type CelsiusValue = typeof Celsius extends { idSchema: z.ZodType<infer T> } ? T : never;
type FahrenheitValue = typeof Fahrenheit extends { idSchema: z.ZodType<infer T> } ? T : never;
type KelvinValue = typeof Kelvin extends { idSchema: z.ZodType<infer T> } ? T : never;

const createDegC = (n: number): CelsiusValue => Celsius.createIdForKey(`${n}` as any);
const createDegF = (n: number): FahrenheitValue => Fahrenheit.createIdForKey(`${n}` as any);
const createK = (n: number): KelvinValue => Kelvin.createIdForKey(`${n}` as any);

// --- Non-linear conversions ---

function celsiusToFahrenheit(v: CelsiusValue): FahrenheitValue {
  const c = extractNumber(v);
  return createDegF(+(c * 9 / 5 + 32).toFixed(6));
}
function fahrenheitToCelsius(v: FahrenheitValue): CelsiusValue {
  const f = extractNumber(v);
  return createDegC(+((f - 32) * 5 / 9).toFixed(6));
}
function celsiusToKelvin(v: CelsiusValue): KelvinValue {
  const c = extractNumber(v);
  return createK(+(c + 273.15).toFixed(6));
}
function kelvinToCelsius(v: KelvinValue): CelsiusValue {
  const k = extractNumber(v);
  return createDegC(+(k - 273.15).toFixed(6));
}
function fahrenheitToKelvin(v: FahrenheitValue): KelvinValue {
  return celsiusToKelvin(fahrenheitToCelsius(v));  // chain through Celsius
}
function kelvinToFahrenheit(v: KelvinValue): FahrenheitValue {
  return celsiusToFahrenheit(kelvinToCelsius(v));  // chain through Celsius
}

// --- Usage ---

const boiling: CelsiusValue = createDegC(100);                    // "degC_100"
const boilingF: FahrenheitValue = celsiusToFahrenheit(boiling);    // "degF_212"
const boilingK: KelvinValue = celsiusToKelvin(boiling);            // "K_373.15"

const bodyTemp: FahrenheitValue = createDegF(98.6);                // "degF_98.6"
const bodyTempC: CelsiusValue = fahrenheitToCelsius(bodyTemp);     // "degC_37"

// Negative values (Celsius and Fahrenheit allow, Kelvin does not)
const freezing: CelsiusValue = createDegC(-40);                    // "degC_-40"
const freezingF: FahrenheitValue = celsiusToFahrenheit(freezing);  // "degF_-40" (the one temp where they match!)

// Kelvin validation rejects negative
const invalidK = Kelvin.parseId("K_-10");  // { success: false, ... }

// Compile-time safety
declare function setThermostat(t: CelsiusValue): void;
setThermostat(boiling);     // ok
setThermostat(bodyTempC);   // ok
// @ts-expect-error — FahrenheitValue is not CelsiusValue
setThermostat(boilingF);
// @ts-expect-error — KelvinValue is not CelsiusValue
setThermostat(boilingK);
```

### Notes on these examples

- **`createNumericValueMethodology`** is the shared foundation — it creates an `IKeyMethodology` for numeric value keys, reusing the same base factory as structured IDs.
- **`extractNumber`** is a simple utility that splits on separator and parses the value portion. In the real implementation, this would be a method on the toolbox.
- **`createIdForKey`** takes a string key (the numeric portion), matching the existing toolbox interface. The `createValue(n: number)` convenience wrapper in the real implementation would handle the `number → string` conversion internally.
- **Conversions are explicit named functions** — no implicit coercion. Each takes a branded input and returns a branded output.
- **Temperature demonstrates non-linear conversions** and shows that `fahrenheitToKelvin` can be composed from simpler conversions rather than duplicating formulas.
- **The `as any` casts on `createIdForKey` calls** are an artifact of these being sketch examples. The real implementation would provide `createValue(n: number)` on the metric toolbox that handles typing cleanly.

## Decisions (resolved)

1. **Keep both branding approaches.** `Branded<T, B>` (unique-symbol generic) stays in `@devalbo/shared` for lightweight cases. The Zod-backed toolbox pattern lives in `@devalbo/branded-types` for structured IDs and validated brands.

2. **Hash key methodology: validate only.** No `createRandomId` for hash keys. Provide `createIdForKey(key: HashKeyValue)` for pre-computed hashes and `parseId`/`assertId` for validation. If random IDs are needed, use the UUID methodology instead.

3. **Separator is a factory-only concern.** Removed `separatorStr` from `IKeyMethodology`. The base factory `createBrandedPrefixKeyStringToolbox(methodology, separator)` takes separator as a required parameter. Convenience factories (`createBrandedUuidToolbox`, `createBrandedNumberIndexToolbox`, `createBrandedHashToolbox`) wrap the base with their default separators.

4. **Test extensively.** Confirm the test runner used across the monorepo and match it. Every methodology, every constructor tier, every edge case. Compile-time misuse tests, runtime validation, roundtrips, invalid input, boundary conditions.
