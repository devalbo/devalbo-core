# Branded Types

## Position
Use branded types to prevent mixing semantically different values that happen to share the same runtime shape. In this codebase, brands are a practical guardrail against cross-domain mistakes — whether those values are strings (IDs, paths, URIs, temporal strings) or numbers (durations, dimensions, ports, indices) — not a theoretical exercise.

## Why
We already rely on typed boundaries across packages. Without brands, many high-risk domains collapse to plain `string` or `number`, and the compiler cannot catch category errors like passing a `groupId` where a `contactId` is expected, or passing milliseconds where seconds are expected.

Branded types give us:
- compile-time prevention of cross-domain value mixups
- clearer function signatures that encode domain intent
- safer refactoring across package boundaries
- fewer runtime bugs caused by accidentally-swapped identifiers/paths/units

## Core Principles
1. Brand values when confusion risk is real.
2. Keep brands compile-time only; no runtime metadata. Runtime string structure (e.g., prefixed IDs) is domain data, not brand metadata. The brand itself remains compile-time only.
3. Validate at untrusted boundaries, not everywhere.
4. Keep persistence/storage primitive-friendly.
5. Adopt incrementally, starting with highest-risk domains.
6. For domain IDs, prefer structured branded strings over opaque plain strings. Structured IDs are self-describing: namespace and key strategy are embedded in the string itself.
7. Keep the raw key and the branded ID tightly linked by construction, not by convention.
8. Document brand composition decisions explicitly (see Brand Composition & Nesting); patterns emerge from practice, not prescription.

## When To Apply Brands
Apply a brand when at least one of these is true:
1. Two or more different domains share the same runtime type and are likely to be confused (for example, `ContactId` vs `GroupId`).
2. The value crosses package/service boundaries where mistakes are expensive.
3. The value is a security/correctness-sensitive token (path, URI, external identifier, strict timestamp).
4. The value appears in multiple APIs where semantic intent is otherwise implicit.
5. The value is a domain ID and should carry its own parseable identity contract (prefix + key methodology, such as UUID or integer index).

Avoid branding when:
- the field is low-risk freeform text
- the value is hyper-local and never crosses meaningful boundaries
- added brand complexity would not reduce a real class of mistakes

## When to Remove a Brand
Retire a brand when its justification no longer holds:
- Two branded domains merge (e.g., `ContactId` and `PersonaId` collapse into a single `EntityId`)
- The value no longer crosses boundaries where confusion is likely
- The domain becomes low-risk or purely local
- Refactoring eliminates the distinction that required separate brands

Process for removal:
1. Verify no remaining call sites rely on the brand's type safety
2. Replace with the more general brand or plain `string` as appropriate
3. Remove brand definition, constructors, and validation
4. Update documentation to reflect the consolidation

Brands should serve current needs, not accumulate as historical artifacts.

## Brand Composition & Nesting
When a branded value is embedded inside another type (for example, a `ContactId` appearing as a field within a compound key or URI), call out the decision explicitly and document it. Do not assume a general rule about whether brands compose or the outer value subsumes the inner brand.

Each instance requires a deliberate choice:
- Does the outer type accept the branded inner value as-is?
- Does the outer type unwrap to the primitive and apply its own brand?
- Should the inner brand remain visible in the type signature?

Log these decisions as they arise. Patterns and principles will emerge only after multiple instances have been discussed and compared.

## Where We Brand

### String Domains
Brand string domains where two or more values are easy to swap:
- filesystem paths: `FilePath`, `DirectoryPath`
- social/entity identifiers: `PersonaId`, `ContactId`, `GroupId`, `MembershipId`
- URI-like identifiers: `Iri`, `WebId`, `UuidUrn`
- temporal strings with strict shape: `IsoDateTime`

### Numeric Domains
Brand numeric domains where unit confusion leads to bugs:
- durations: `Milliseconds`, `Seconds`, `Minutes`
- dimensions/layout: `Pixels`, `Rem`, `Percentage`
- network: `PortNumber`
- indices: `ZeroBasedIndex`, `OneBasedIndex`
- quantities: `ByteCount`, `ItemCount`

Do not brand low-risk freeform text fields or generic numeric counters by default.

## Branded Numeric Types
Branded numbers follow the same core principles as branded strings: the brand is compile-time only, validated at boundaries, and stored as a plain `number` in persistence.

**Why brand numbers?**
Numeric types are especially prone to silent unit confusion. Passing milliseconds to a function expecting seconds compiles without error and produces a bug that's hard to trace — the value is "correct" in shape but wrong by orders of magnitude.

**Pattern:**
```ts
type Milliseconds = number & { readonly __brand: 'Milliseconds' };
type Seconds = number & { readonly __brand: 'Seconds' };
type Pixels = number & { readonly __brand: 'Pixels' };
type PortNumber = number & { readonly __brand: 'PortNumber' };
```

**Constructors follow the same tiers as string brands:**
- `unsafeAsMilliseconds(value)`: trusted internal cast
- `parseMilliseconds(value)`: returns SafeParseReturnType (validates non-negative, finite, etc.)
- `assertMilliseconds(value)`: throws on invalid

**Conversions between related units should be explicit named functions:**
```ts
function millisToSeconds(ms: Milliseconds): Seconds {
  return unsafeAsSeconds(ms / 1000);
}

function secondsToMillis(s: Seconds): Milliseconds {
  return unsafeAsMilliseconds(s * 1000);
}

function pxToRem(px: Pixels, baseFontSize: Pixels = unsafeAsPixels(16)): Rem {
  return unsafeAsRem(px / baseFontSize);
}
```

**Validation examples:**
```ts
function parsePortNumber(value: number): SafeParseReturnType<PortNumber> {
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    return { success: false, error: /* ... */ };
  }
  return { success: true, data: value as PortNumber };
}

function parseMilliseconds(value: number): SafeParseReturnType<Milliseconds> {
  if (!Number.isFinite(value) || value < 0) {
    return { success: false, error: /* ... */ };
  }
  return { success: true, data: value as Milliseconds };
}
```

**Compile-time misuse prevention:**
```ts
declare const timeout: Milliseconds;
declare const delay: Seconds;

setTimeout(callback, timeout); // ok — setTimeout expects ms
// @ts-expect-error Seconds is not Milliseconds
setTimeout(callback, delay);

// Explicit conversion required
setTimeout(callback, secondsToMillis(delay)); // ok
```

**Arithmetic and branded numbers:**
Standard arithmetic operators strip brands (`Milliseconds + Milliseconds` returns `number`, not `Milliseconds`). Handle this by:
- Wrapping arithmetic results with `unsafeAsX` when the operation preserves the unit
- Using explicit helper functions for common operations

```ts
function addMilliseconds(a: Milliseconds, b: Milliseconds): Milliseconds {
  return unsafeAsMilliseconds(a + b);
}

function scaleMilliseconds(ms: Milliseconds, factor: number): Milliseconds {
  return unsafeAsMilliseconds(ms * factor);
}
```

**When not to brand numbers:**
- Generic counters with no unit confusion risk
- Intermediate calculation values that stay local
- Cases where arithmetic ergonomics outweigh safety benefits (brand after computing, not during)

## Structured IDs
In this codebase, a **structured ID** is a branded identifier that embeds its domain and key methodology directly in its string representation. Rather than storing opaque values like `"550e8400-e29b-41d4-a716-446655440000"` or `"42"` and maintaining separate metadata about what domain they belong to, structured IDs make this information intrinsic.

**Format:** `prefix_key` or `prefixkey` (separator is a design decision per ID family)

**Examples:**
- `game_550e8400-e29b-41d4-a716-446655440000` (UUID-based)
- `seat42` (numeric index-based)
- `contact_8a7b2c1d` (shortened hash-based)

**Key methodologies:**

1. **UuidKey** - Full UUID (RFC 4122) as the key portion
   - Format: `prefix_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Use when: Globally unique IDs needed, random generation, distributed systems
   - Example: `game_550e8400-e29b-41d4-a716-446655440000`

2. **NumberIndexKey** - Sequential or explicit numeric index
   - Format: `prefixN` or `prefix_N` (separator is a design decision)
   - Use when: Auto-incrementing IDs, small bounded sets, human-readable sequences
   - Example: `seat42`, `row_7`

3. **HashKey** - Shortened hash (typically 8-16 hex characters)
   - Format: `prefix_HHHHHHHH` (length is a design decision, typically 8 or 16 chars)
   - Use when: Collision resistance needed but UUIDs are too long, content-addressable IDs, deterministic generation from input data
   - Example: `contact_8a7b2c1d`, `session_a3f29bc4e1d8`
   - Note: Choose hash length based on collision probability for your domain size

**Key characteristics:**
- **Self-describing**: The ID itself declares its domain (prefix) and key type
- **Parseable contract**: Any consumer can extract the prefix and validate the key format
- **Single source of truth**: No separate "type" field needed; the ID carries its own identity
- **Collision-resistant across domains**: `contact_123` and `group_123` cannot be confused

**When to use structured IDs:**
- Domain entities that cross package/service boundaries
- IDs that will be stored, logged, or transmitted where context might be lost
- Systems where multiple ID types coexist and must remain distinguishable
- Cases where debugging benefits from human-readable ID inspection

**When not to use structured IDs:**
- Purely internal, short-lived identifiers that never leave a single module
- Performance-critical paths where string parsing overhead matters
- External system integration where ID format is dictated by the external party

Structured IDs pair naturally with branded types: the brand provides compile-time safety, while the structure provides runtime clarity.

## Constructor Tiers
Use explicit constructor tiers so trust level is visible in code:
- `unsafeAsX(value)`: trusted/internal casts only
- `parseX(value)`: returns Zod SafeParseReturnType for explicit error handling
- `assertX(value)`: throws on invalid untrusted input (optimistic variant)

The caller decides how to handle validation failures:
- Use `parseX` when you need to inspect errors or handle them gracefully
- Use `assertX` when invalid input is exceptional and should abort

Rule of thumb:
- trusted source (already validated or internal invariant): `unsafeAsX`
- external/user/file/network input where errors are expected: `parseX`
- external/user/file/network input where errors are exceptional: `assertX`

For ID brands, expose a small toolbox API per ID family:
- `createRandomId()`: generate a valid branded ID
- `createIdForKey(key)`: deterministically build branded ID from UUID/int key
- `parseId(id)`: validate and return SafeParseReturnType
- `assertId(id)`: validate and return branded ID (throws on invalid)

## Boundary Rules
- command/API/UI input boundaries: parse/assert into brands.
- package/service/accessor boundaries: accept/return branded values when domain is known.
- storage boundaries (TinyBase): store primitives (`string` / `number`), re-apply brands at typed edges.
- JSON/serialization boundaries: brands are lost on `JSON.stringify`. Re-apply brands via `parseX`/`assertX` at the deserialization boundary, just as with storage reads.
- ID boundaries: prefer a single structured branded ID string instead of separate loosely-coupled `id` + `uuid/int` fields.

Brands are for correctness at typed boundaries, not for changing on-disk/in-memory persistence formats.

## Naming Conventions
- Identifier brands end with `Id` (for example, `ContactId`).
- URI-like brands use explicit names (`Iri`, `WebId`, `UuidUrn`).
- Date-time brands use semantic format names (`IsoDateTime`).
- ID families define explicit prefix constants and key methodology (`UuidKey`, `NumberIndexKey`, or `HashKey`) so format rules are centralized.
- Separator choice (e.g., `game_550e8400` vs `seat42`) is a design decision per ID family. Document the separator convention in each family's schema and apply it consistently. Common patterns: underscore for UUID-based IDs, no separator or underscore for numeric IDs.

## Adoption Order
1. Paths and command args
2. Accessor row IDs and reference IDs
3. Social vocab fields (web IDs, IRIs, UUID URNs, timestamps)
4. Additional domains only when confusion risk justifies it

## Methodology
Use this rollout method for each new branded domain:
1. Define the brand type and canonical schema in `@devalbo/shared`.
2. Add constructor surfaces by trust level:
- `unsafeAsX` for trusted internal invariants only
- `parseX` / `assertX` for untrusted input
3. If the domain is an ID, define:
- prefix constant(s)
- key methodology (`UuidKey`, `NumberIndexKey`, or `HashKey`)
- toolbox (`createRandomId`, `createIdForKey`, `parseId`, `assertId`)
4. Apply at boundaries first (CLI/API/UI parsing), then thread through internal accessors/services.
5. Keep storage primitive (`string`) and re-brand at typed boundaries on read/write paths.
6. Add tests (see Testing Expectations section for details).

## Examples
### Structured UUID ID Family
```ts
type GameId = PrefixKeyId<'game', UuidKey>;

const GameIdToolbox = createBrandedUuidIdToolbox('game');

const id1: GameId = GameIdToolbox.createRandomId(); // produces "game_550e8400-e29b-41d4-a716-446655440000" (underscore separator by design)
const id2: GameId = GameIdToolbox.createIdForKey('550e8400-e29b-41d4-a716-446655440000' as UuidKey);

// Use parseId when you need to handle errors
const parseResult = GameIdToolbox.parseId('game_550e8400-e29b-41d4-a716-446655440000');
if (parseResult.success) {
  const id3: GameId = parseResult.data;
}

// Use assertId when invalid input is exceptional
const id4: GameId = GameIdToolbox.assertId('game_550e8400-e29b-41d4-a716-446655440000');
```

### Structured Numeric ID Family
```ts
type SeatId = PrefixKeyId<'seat', NumberIndexKey>;

const SeatIdToolbox = createBrandedNumberIndexIdToolbox('seat');

const seatA: SeatId = SeatIdToolbox.createIdForKey('42' as NumberIndexKey); // produces "seat42" (no separator by design)

// Use parseId for error handling
const parseResult = SeatIdToolbox.parseId('seat42');
if (parseResult.success) {
  const seatB: SeatId = parseResult.data;
}

// Use assertId when invalid input should throw
const seatC: SeatId = SeatIdToolbox.assertId('seat42');
```

### Structured Hash ID Family
```ts
type ContactId = PrefixKeyId<'contact', HashKey>;

const ContactIdToolbox = createBrandedHashIdToolbox('contact', { hashLength: 8 });

// Generate from source data (deterministic)
const contactA: ContactId = ContactIdToolbox.createIdForKey('8a7b2c1d' as HashKey); // produces "contact_8a7b2c1d"

// Parse with validation
const parseResult = ContactIdToolbox.parseId('contact_8a7b2c1d');
if (parseResult.success) {
  const contactB: ContactId = parseResult.data;
}

// Assert for optimistic parsing
const contactC: ContactId = ContactIdToolbox.assertId('contact_8a7b2c1d');
```

### Boundary Parsing Pattern

**Alternative 1: Use parseX for graceful error handling**

```ts
// Untrusted API input - handle errors gracefully
const parseResult = ContactIdSchema.safeParse(req.params.contactId);
if (!parseResult.success) {
  return { error: parseResult.error };
}
const contactId = parseResult.data;

// Trusted internal path after validation
setDefaultPersona(store, contactId, unsafeAsPersonaId(personaIdFromInvariant));
```

**Alternative 2: Use assertX when invalid input should abort**

```ts
// Untrusted API input - throws on invalid
const contactId = assertContactId(req.params.contactId);

// Trusted internal path after validation
setDefaultPersona(store, contactId, unsafeAsPersonaId(personaIdFromInvariant));
```

### Compile-Time Misuse Prevention
```ts
declare const contactId: ContactId;
declare const groupId: GroupId;

setDefaultContact(store, contactId); // ok
// @ts-expect-error GroupId is not ContactId
setDefaultContact(store, groupId);
```

## Testing Expectations
- compile-time misuse tests (`@ts-expect-error`) for swapped domains
- schema inference tests to confirm branded outputs
- runtime tests for parse/assert behavior
- roundtrip checks through persistence boundaries

## Future Avenue: Branded Metric Values

The structured prefix-key pattern generalizes beyond identifiers to **physical measurement values** — string-encoded quantities that embed their unit in the runtime representation, such as `lbs_1.5`, `psi_2.3`, `volts_4.7`. This is a natural extension of the same branded infrastructure.

**Concept:** A branded metric value is a string of the form `unit_numericValue` where the prefix is the unit of measurement and the key is a decimal number. The brand prevents mixing incompatible units at compile time, while the string carries its unit at runtime.

```ts
type PoundsValue = BrandedMetricValue<'lbs'>;
type PsiValue = BrandedMetricValue<'psi'>;
type VoltsValue = BrandedMetricValue<'volts'>;

const weight: PoundsValue = Pounds.createValue(1.5);    // "lbs_1.5"
const pressure: PsiValue = Psi.createValue(2.3);        // "psi_2.3"

// Compile-time safety
declare function applyForce(p: PsiValue): void;
applyForce(pressure);    // ok
// @ts-expect-error — PoundsValue is not PsiValue
applyForce(weight);

// Extract numeric value back out
const n: number = Pounds.extractNumber(weight);          // 1.5
```

**Scope:** This covers ~160 units across 16 measurement domains — length, mass, volume, area, temperature, time, speed, pressure, force, energy, power, electrical, frequency, torque, flow rate, density, luminosity, angle, and data/information — in both metric (SI) and US customary systems.

**Relationship to core branded types:** Metric values reuse the same `createBrandedPrefixKeyStringToolboxWithSeparator` base factory from `@devalbo/branded-types`, introducing a `NumericValueKey` methodology where the key portion is a decimal number rather than a UUID or index. The core branding package should be implemented first; the units package is a follow-on that builds on top of it.

**Design considerations:**
- **Separator ambiguity** — Compound units like `m_s` (meters/second) and `kg_m3` (kg/m³) use `_` in the unit name, which overlaps with the value separator. Resolution: use `__` as the value separator for compound units, or `/` for "per" (e.g., `m/s_9.8`).
- **Case sensitivity** — `mW` (milliwatt) vs `MW` (megawatt). Prefixes must be case-sensitive.
- **SI prefix stacking** — Rather than enumerating every combination (milliwatt, kilowatt, megawatt...), a systematic approach could define base units + SI prefix multipliers.
- **String vs number at rest** — String encoding (`"lbs_1.5"`) is best for boundary/storage/transmission where self-description matters. For computation-heavy paths, use branded numbers internally and convert at boundaries.

See `UNITS_BRAND_IMPL.md` for the full implementation plan as a separate `@devalbo/branded-units` package.

## Non-Goals
- No runtime brand tagging.
- No requirement to brand every string.
- No forced storage schema changes just to support brands.

## Compatibility Strategy
Adopt brands without breaking call sites unnecessarily:
- allow string inputs at external package boundaries initially
- prefer branded overloads/types internally
- migrate toward branded-first signatures as touchpoints are updated

A boundary is fully migrated when its public signature accepts only branded types and no plain-string overload remains. Until then, treat string overloads as transitional scaffolding to be removed once callers have been updated.

Migration stages per boundary:
1. Initial: accepts `string`, internal code may use brands
2. Transitional: accepts `string | BrandedType`, branded overload preferred
3. Complete: accepts only `BrandedType`, no string fallback
