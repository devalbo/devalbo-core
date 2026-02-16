# Branded Units Package Plan

## Overview

Create a `@devalbo/branded-units` package that provides branded metric value types for physical measurements. This package builds on top of `@devalbo/branded-types` and must not block its implementation — the core branding infrastructure is a prerequisite.

## Relationship to `@devalbo/branded-types`

```
@devalbo/branded-types     (core — implement first, independent)
        ↑
@devalbo/branded-units     (follow-on — depends on branded-types)
```

**Dependency direction:** `branded-units` → `branded-types`. Never the reverse.

**What branded-units uses from branded-types:**
- `createBrandedPrefixKeyStringToolboxWithSeparator` base factory
- `IKeyMethodology` interface
- `IBrandedPrefixKeyStringToolbox` interface
- `IdTypePrefixBrand`, `IdTypeKeyMethodBrand` base types
- `RegexableString`

**What branded-units adds:**
- `NumericValueKey` methodology (decimal number as the key portion)
- `IBrandedMetricToolbox` interface (extends toolbox with `createValue` and `extractNumber`)
- Unit prefix constants and types for all measurement domains
- Optional range/precision constraints per unit
- Conversion utilities between related units

## Package Structure

```
packages/branded-units/
├── src/
│   ├── index.ts                           # Public API exports
│   ├── core/
│   │   ├── numeric-value-key.ts           # NumericValueKey methodology
│   │   ├── metric-toolbox.ts              # IBrandedMetricToolbox interface & factory
│   │   └── si-prefixes.ts                 # SI prefix multiplier system
│   ├── units/
│   │   ├── length.ts                      # Length/distance units
│   │   ├── mass.ts                        # Mass/weight units
│   │   ├── volume.ts                      # Volume units
│   │   ├── area.ts                        # Area units
│   │   ├── temperature.ts                 # Temperature units
│   │   ├── time.ts                        # Time units
│   │   ├── speed.ts                       # Speed/velocity units
│   │   ├── pressure.ts                    # Pressure units
│   │   ├── force.ts                       # Force units
│   │   ├── energy.ts                      # Energy units
│   │   ├── power.ts                       # Power units
│   │   ├── electrical.ts                  # Voltage, current, resistance, capacitance, inductance
│   │   ├── frequency.ts                   # Frequency units
│   │   ├── torque.ts                      # Torque units
│   │   ├── flow-rate.ts                   # Flow rate units
│   │   ├── density.ts                     # Density units
│   │   ├── luminosity.ts                  # Luminosity/light units
│   │   ├── angle.ts                       # Angle units
│   │   └── data.ts                        # Data/information units
│   └── conversions/
│       ├── length.ts                      # Length conversion functions
│       ├── mass.ts                        # Mass conversion functions
│       ├── volume.ts                      # Volume conversion functions
│       ├── temperature.ts                 # Temperature conversion functions
│       └── ...                            # One per domain with conversions
├── tests/
│   ├── numeric-value-key.test.ts          # Core methodology tests
│   ├── metric-toolbox.test.ts             # Toolbox factory tests
│   ├── si-prefixes.test.ts                # SI prefix system tests
│   ├── units/                             # Per-domain unit tests
│   │   ├── length.test.ts
│   │   ├── mass.test.ts
│   │   └── ...
│   ├── conversions/                       # Per-domain conversion tests
│   │   ├── length.test.ts
│   │   └── ...
│   └── compile-time.test.ts              # Cross-unit type safety tests
├── package.json
├── tsconfig.json
└── README.md
```

## Core API

### NumericValueKey Methodology

A new key methodology where the key portion is a decimal number rather than a UUID or index.

```ts
// core/numeric-value-key.ts
const NumericValueRegexString = "-?[0-9]+(\\.[0-9]+)?" as RegexableString;

// Regex adjusts based on options:
// allowNegative: false → "[0-9]+(\\.[0-9]+)?"
// precision: 2 → "-?[0-9]+(\\.[0-9]{1,2})?"
```

### IBrandedMetricToolbox

Extends the standard toolbox interface with measurement-specific methods.

```ts
interface IBrandedMetricToolbox<U extends MetricUnit> {
  unit: U;
  metricSchema: z.ZodType<BrandedMetricValue<U>>;

  // Construction — from number to branded string
  createValue: (n: number) => BrandedMetricValue<U>;

  // Validation — standard two-variant pattern
  parseValue: (s: string) => z.SafeParseReturnType<string, BrandedMetricValue<U>>;
  assertValue: (s: string) => BrandedMetricValue<U>;

  // Extraction — branded string back to number
  extractNumber: (v: BrandedMetricValue<U>) => number;
}
```

### Factory

```ts
const createBrandedMetricToolbox = <U extends MetricUnit>(
  unit: U,
  options?: {
    separator?: string;          // default "_"
    allowNegative?: boolean;     // default true
    precision?: number;          // max decimal places (undefined = unlimited)
    min?: number;                // optional range floor
    max?: number;                // optional range ceiling
  }
): IBrandedMetricToolbox<U>;
```

**NOTE:** `createRandomId` is NOT provided. Metric values are always constructed from known numbers, not generated randomly.

## Design Decisions

### Separator Strategy

**Problem:** Compound units like `m_s` (meters per second) and `kg_m3` (kg/m³) use `_` in the unit prefix, which collides with the separator between prefix and value.

**Decision:** TBD — evaluate during implementation. Candidates:
1. **Double underscore for value separator:** `m_s__9.8`, `kg_m3__997`
2. **Slash for "per" in compound units:** `m/s_9.8`, `kg/m3_997`
3. **No compound unit prefixes:** Use dedicated prefixes instead: `mps_9.8`, `kgm3_997`
4. **Parenthetical grouping:** `(m/s)_9.8`

Recommendation: Start with option 3 (dedicated prefixes) for simplicity. Compound unit syntax can be added later if needed.

### Case Sensitivity

Prefixes are case-sensitive. `mW` (milliwatt) and `MW` (megawatt) are distinct. Validation must preserve case.

### SI Prefix Stacking

Rather than manually defining every SI-prefixed variant (milliwatt, kilowatt, megawatt...), provide a systematic approach:

```ts
// core/si-prefixes.ts
const SI_PREFIXES = {
  pico:  { symbol: 'p',  factor: 1e-12 },
  nano:  { symbol: 'n',  factor: 1e-9 },
  micro: { symbol: 'u',  factor: 1e-6 },
  milli: { symbol: 'm',  factor: 1e-3 },
  centi: { symbol: 'c',  factor: 1e-2 },
  deci:  { symbol: 'd',  factor: 1e-1 },
  base:  { symbol: '',   factor: 1 },
  deca:  { symbol: 'da', factor: 1e1 },
  hecto: { symbol: 'h',  factor: 1e2 },
  kilo:  { symbol: 'k',  factor: 1e3 },
  mega:  { symbol: 'M',  factor: 1e6 },
  giga:  { symbol: 'G',  factor: 1e9 },
  tera:  { symbol: 'T',  factor: 1e12 },
} as const;

// Generate toolbox for a base unit at a specific SI prefix
const createSIPrefixedMetricToolbox = <U extends MetricUnit>(
  baseSymbol: string,
  prefix: keyof typeof SI_PREFIXES,
): IBrandedMetricToolbox<U>;
```

Individual unit files can use this for systematic generation while still allowing manual overrides where naming conventions differ (e.g., `kg` not `kg` derived from `g` with kilo prefix — kilogram is the SI base unit, not gram).

### Unicode Avoidance

All prefixes use ASCII-safe representations:
- `u` for micro (μ)
- `Ohm` for Ω
- `deg` for °
- `m2` for m², `m3` for m³

## Full Unit Inventory

### Length / Distance

| Unit | System | Prefix | Example |
|---|---|---|---|
| Nanometer | Metric | `nm` | `nm_450` |
| Micrometer | Metric | `um` | `um_12.5` |
| Millimeter | Metric | `mm` | `mm_3.2` |
| Centimeter | Metric | `cm` | `cm_15.0` |
| Meter | Metric | `m` | `m_1.82` |
| Kilometer | Metric | `km` | `km_5.3` |
| Thou / Mil | US | `mil` | `mil_250` |
| Inch | US | `in` | `in_6.5` |
| Foot | US | `ft` | `ft_12.0` |
| Yard | US | `yd` | `yd_100` |
| Mile | US | `mi` | `mi_3.1` |
| Nautical Mile | Intl | `nmi` | `nmi_2.5` |

### Mass / Weight

| Unit | System | Prefix | Example |
|---|---|---|---|
| Microgram | Metric | `ug` | `ug_500` |
| Milligram | Metric | `mg` | `mg_200` |
| Gram | Metric | `g` | `g_453.6` |
| Kilogram | Metric | `kg` | `kg_82.5` |
| Metric Ton (Tonne) | Metric | `t` | `t_2.4` |
| Grain | US | `gr` | `gr_77` |
| Ounce | US | `oz` | `oz_8.0` |
| Pound | US | `lb` | `lb_165.3` |
| Short Ton (US Ton) | US | `ton` | `ton_1.5` |

### Volume

| Unit | System | Prefix | Example |
|---|---|---|---|
| Microliter | Metric | `uL` | `uL_50` |
| Milliliter | Metric | `mL` | `mL_250` |
| Centiliter | Metric | `cL` | `cL_33` |
| Liter | Metric | `L` | `L_2.0` |
| Cubic Centimeter | Metric | `cc` | `cc_450` |
| Cubic Meter | Metric | `m3` | `m3_1.5` |
| Teaspoon | US | `tsp` | `tsp_2.0` |
| Tablespoon | US | `tbsp` | `tbsp_1.5` |
| Fluid Ounce | US | `fl_oz` | `fl_oz_8.0` |
| Cup | US | `cup` | `cup_2.0` |
| Pint | US | `pt` | `pt_1.0` |
| Quart | US | `qt` | `qt_1.5` |
| Gallon | US | `gal` | `gal_3.2` |
| Cubic Inch | US | `cu_in` | `cu_in_231` |
| Cubic Foot | US | `cu_ft` | `cu_ft_4.5` |

### Area

| Unit | System | Prefix | Example |
|---|---|---|---|
| Square Millimeter | Metric | `mm2` | `mm2_45.0` |
| Square Centimeter | Metric | `cm2` | `cm2_120` |
| Square Meter | Metric | `m2` | `m2_85.5` |
| Hectare | Metric | `ha` | `ha_2.3` |
| Square Kilometer | Metric | `km2` | `km2_15.7` |
| Square Inch | US | `sq_in` | `sq_in_36.0` |
| Square Foot | US | `sq_ft` | `sq_ft_1500` |
| Square Yard | US | `sq_yd` | `sq_yd_4840` |
| Acre | US | `acre` | `acre_40.0` |
| Square Mile | US | `sq_mi` | `sq_mi_2.5` |

### Temperature

| Unit | System | Prefix | Example |
|---|---|---|---|
| Celsius | Metric | `degC` | `degC_22.5` |
| Kelvin | Metric/SI | `K` | `K_295.65` |
| Fahrenheit | US | `degF` | `degF_72.5` |
| Rankine | US | `degR` | `degR_532.17` |

### Time

| Unit | System | Prefix | Example |
|---|---|---|---|
| Nanosecond | SI | `ns` | `ns_500` |
| Microsecond | SI | `us` | `us_1200` |
| Millisecond | SI | `ms` | `ms_250` |
| Second | SI | `s` | `s_30.0` |
| Minute | SI | `min` | `min_5.0` |
| Hour | SI | `hr` | `hr_2.5` |
| Day | SI | `d` | `d_7` |

### Speed / Velocity

| Unit | System | Prefix | Example |
|---|---|---|---|
| Meters per Second | Metric | `mps` | `mps_9.8` |
| Kilometers per Hour | Metric | `kmh` | `kmh_120` |
| Feet per Second | US | `fps` | `fps_32.2` |
| Miles per Hour | US | `mph` | `mph_65.0` |
| Knot | Intl | `kn` | `kn_25.3` |

### Pressure

| Unit | System | Prefix | Example |
|---|---|---|---|
| Pascal | Metric/SI | `Pa` | `Pa_101325` |
| Kilopascal | Metric | `kPa` | `kPa_101.3` |
| Megapascal | Metric | `MPa` | `MPa_2.5` |
| Bar | Metric | `bar` | `bar_1.013` |
| Millibar | Metric | `mbar` | `mbar_1013` |
| Pounds per Square Inch | US | `psi` | `psi_14.7` |
| Inches of Mercury | US | `inHg` | `inHg_29.92` |
| Atmosphere | Intl | `atm` | `atm_1.0` |
| Torr | Intl | `torr` | `torr_760` |

### Force

| Unit | System | Prefix | Example |
|---|---|---|---|
| Newton | Metric/SI | `N` | `N_9.81` |
| Kilonewton | Metric | `kN` | `kN_50.0` |
| Dyne | Metric (CGS) | `dyn` | `dyn_980665` |
| Pound-Force | US | `lbf` | `lbf_100.0` |
| Ounce-Force | US | `ozf` | `ozf_16.0` |

### Energy

| Unit | System | Prefix | Example |
|---|---|---|---|
| Joule | Metric/SI | `J` | `J_4184` |
| Kilojoule | Metric | `kJ` | `kJ_4.184` |
| Calorie | Metric | `cal` | `cal_1000` |
| Kilocalorie | Metric | `kcal` | `kcal_2000` |
| Watt-Hour | Metric | `Wh` | `Wh_500` |
| Kilowatt-Hour | Metric | `kWh` | `kWh_12.5` |
| Electronvolt | SI | `eV` | `eV_1.6` |
| British Thermal Unit | US | `BTU` | `BTU_3412` |
| Foot-Pound | US | `ft_lb` | `ft_lb_550` |
| Therm | US | `therm` | `therm_1.5` |

### Power

| Unit | System | Prefix | Example |
|---|---|---|---|
| Milliwatt | Metric | `mW` | `mW_500` |
| Watt | Metric/SI | `W` | `W_60.0` |
| Kilowatt | Metric | `kW` | `kW_1.5` |
| Megawatt | Metric | `MW` | `MW_500` |
| Gigawatt | Metric | `GW` | `GW_1.21` |
| Horsepower (mechanical) | US | `hp` | `hp_250` |
| BTU per Hour | US | `BTUh` | `BTUh_12000` |

### Electrical

| Unit | System | Prefix | Example |
|---|---|---|---|
| Microvolt | SI | `uV` | `uV_500` |
| Millivolt | SI | `mV` | `mV_3300` |
| Volt | SI | `V` | `V_120.0` |
| Kilovolt | SI | `kV` | `kV_13.8` |
| Microampere | SI | `uA` | `uA_50` |
| Milliampere | SI | `mA` | `mA_500` |
| Ampere | SI | `A` | `A_15.0` |
| Milliohm | SI | `mOhm` | `mOhm_100` |
| Ohm | SI | `Ohm` | `Ohm_470` |
| Kilohm | SI | `kOhm` | `kOhm_10.0` |
| Megohm | SI | `MOhm` | `MOhm_1.0` |
| Picofarad | SI | `pF` | `pF_100` |
| Nanofarad | SI | `nF` | `nF_47` |
| Microfarad | SI | `uF` | `uF_1000` |
| Farad | SI | `F` | `F_1.0` |
| Microhenry | SI | `uH` | `uH_10` |
| Millihenry | SI | `mH` | `mH_330` |
| Henry | SI | `H` | `H_1.0` |

### Frequency

| Unit | System | Prefix | Example |
|---|---|---|---|
| Hertz | SI | `Hz` | `Hz_60` |
| Kilohertz | SI | `kHz` | `kHz_44.1` |
| Megahertz | SI | `MHz` | `MHz_2400` |
| Gigahertz | SI | `GHz` | `GHz_5.8` |
| RPM | Intl | `rpm` | `rpm_3600` |

### Torque

| Unit | System | Prefix | Example |
|---|---|---|---|
| Newton-Meter | Metric/SI | `Nm` | `Nm_400` |
| Kilonewton-Meter | Metric | `kNm` | `kNm_1.2` |
| Foot-Pound Force | US | `ft_lbf` | `ft_lbf_295` |
| Inch-Pound Force | US | `in_lbf` | `in_lbf_24.0` |

### Flow Rate

| Unit | System | Prefix | Example |
|---|---|---|---|
| Milliliters per Minute | Metric | `mLmin` | `mLmin_500` |
| Liters per Minute | Metric | `Lmin` | `Lmin_12.5` |
| Cubic Meters per Hour | Metric | `m3h` | `m3h_100` |
| Gallons per Minute | US | `gpm` | `gpm_5.0` |
| Cubic Feet per Minute | US | `cfm` | `cfm_200` |

### Density

| Unit | System | Prefix | Example |
|---|---|---|---|
| Kilograms per Cubic Meter | Metric | `kgm3` | `kgm3_997` |
| Grams per Milliliter | Metric | `gmL` | `gmL_1.0` |
| Grams per Cubic Centimeter | Metric | `gcc` | `gcc_2.7` |
| Pounds per Cubic Foot | US | `lbft3` | `lbft3_62.4` |
| Pounds per Gallon | US | `lbgal` | `lbgal_8.34` |

### Luminosity / Light

| Unit | System | Prefix | Example |
|---|---|---|---|
| Candela | SI | `cd` | `cd_1000` |
| Lumen | SI | `lm` | `lm_800` |
| Lux | SI | `lx` | `lx_500` |
| Foot-Candle | US | `fc` | `fc_50.0` |

### Angle

| Unit | System | Prefix | Example |
|---|---|---|---|
| Degree | Intl | `deg` | `deg_90.0` |
| Radian | SI | `rad` | `rad_3.14159` |
| Gradian | Intl | `grad` | `grad_100` |
| Arcminute | Intl | `arcmin` | `arcmin_30` |
| Arcsecond | Intl | `arcsec` | `arcsec_45.0` |

### Data / Information

| Unit | System | Prefix | Example |
|---|---|---|---|
| Bit | Intl | `b` | `b_8` |
| Byte | Intl | `B` | `B_1024` |
| Kilobyte | Intl | `KB` | `KB_256` |
| Megabyte | Intl | `MB` | `MB_512` |
| Gigabyte | Intl | `GB` | `GB_16.0` |
| Terabyte | Intl | `TB` | `TB_2.0` |
| Kibibyte | IEC | `KiB` | `KiB_256` |
| Mebibyte | IEC | `MiB` | `MiB_512` |
| Gibibyte | IEC | `GiB` | `GiB_16.0` |
| Tebibyte | IEC | `TiB` | `TiB_2.0` |
| Bits per Second | Intl | `bps` | `bps_1000` |
| Kilobits per Second | Intl | `kbps` | `kbps_100` |
| Megabits per Second | Intl | `Mbps` | `Mbps_1000` |
| Gigabits per Second | Intl | `Gbps` | `Gbps_10.0` |

## Conversion Utilities

Each measurement domain provides explicit conversion functions between its units. Conversions are type-safe: input and output are branded.

```ts
// conversions/length.ts
function inchesToCentimeters(v: InchValue): CentimeterValue {
  const n = Inches.extractNumber(v);
  return Centimeters.createValue(n * 2.54);
}

function centimetersToInches(v: CentimeterValue): InchValue {
  const n = Centimeters.extractNumber(v);
  return Inches.createValue(n / 2.54);
}

// conversions/temperature.ts — non-linear conversions
function celsiusToFahrenheit(v: CelsiusValue): FahrenheitValue {
  const n = Celsius.extractNumber(v);
  return Fahrenheit.createValue(n * 9 / 5 + 32);
}
```

## Implementation Phases

### Phase 1: Core methodology (depends on `@devalbo/branded-types`)

1. Implement `NumericValueKey` methodology in `core/numeric-value-key.ts`
   - Decimal number regex (configurable: allow negative, precision)
   - Plugs into `createBrandedPrefixKeyStringToolboxWithSeparator` from branded-types
2. Implement `IBrandedMetricToolbox` in `core/metric-toolbox.ts`
   - `createValue(n)`, `parseValue(s)`, `assertValue(s)`, `extractNumber(v)`
   - Factory with range/precision options
3. Implement SI prefix system in `core/si-prefixes.ts`
   - Prefix constants with symbols and multiplier factors
   - Factory for generating SI-prefixed toolboxes from a base unit

### Phase 2: Unit definitions

4. Implement each domain file in `units/`
   - Define unit prefix constants
   - Create toolbox instances via factory
   - Apply domain-specific constraints (e.g., temperature min, port range)
   - Export branded types and toolboxes

Recommended order:
1. Length (simplest, most familiar, good for validating the pattern)
2. Mass
3. Temperature (non-linear conversions test the conversion pattern)
4. Time
5. Pressure, Force, Energy, Power (build on earlier patterns)
6. Electrical, Frequency (SI prefix stacking validation)
7. Remaining domains

### Phase 3: Conversions

5. Implement conversion functions per domain
   - All conversions are typed: branded input → branded output
   - Linear conversions (most units): multiply/divide by factor
   - Non-linear conversions (temperature): explicit formula
   - Test roundtrip accuracy within floating-point tolerance

### Phase 4: Tests

6. Test each domain:
   - Toolbox creation and value construction
   - Parse/assert with valid and invalid inputs
   - extractNumber roundtrip accuracy
   - Range constraint enforcement (min/max/precision)
   - Cross-unit type safety (`@ts-expect-error`)
   - Conversion accuracy within floating-point tolerance
   - Conversion type safety (input brand → output brand)
   - Edge cases: 0, negative zero, very large/small values, max precision

## Dependencies

| Dependency | Version | Reason |
|---|---|---|
| `@devalbo/branded-types` | `workspace:*` | Core branding infrastructure |
| `zod` | `^4.3.6` | Schema validation (transitive via branded-types, but direct for unit schemas) |

No other runtime dependencies.

## Open Questions

1. **Separator strategy for compound units** — Start with dedicated prefixes (option 3 from design decisions)? Or commit to a compound syntax now? Recommendation: start simple, defer compound syntax until a real use case demands it.

2. **Should conversions live in this package or a separate `@devalbo/unit-conversions` package?** If the unit definitions are large, conversions add significant bulk. Recommendation: keep together initially, split later if package size becomes a concern.

3. **How to handle precision loss in conversions?** Floating-point arithmetic introduces rounding. Should conversions accept a precision parameter? Recommendation: document that conversions are subject to floating-point precision; consumers should round at their own boundaries.

4. **Should SI prefix stacking be the primary API or a convenience layer?** Some units don't follow SI conventions cleanly (kilogram is the base unit, not gram; temperature prefixes don't apply). Recommendation: manual definition is primary, SI prefix stacking is an optional accelerator.
