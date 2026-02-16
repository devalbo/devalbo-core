import { describe, expect, it } from 'vitest';
import {
  createDegC,
  createDegF,
  createFt,
  createK,
  createKg,
  createLb,
  createM,
  celsiusToFahrenheit,
  celsiusToKelvin,
  fahrenheitToCelsius,
  fahrenheitToKelvin,
  feetToMeters,
  kilogramsToPounds,
  kelvinToCelsius,
  metersToFeet,
  poundsToKilograms,
  DegCToolbox,
  DegFToolbox,
  KToolbox,
  KgToolbox,
  LbToolbox,
  MToolbox,
  FtToolbox,
  type CelsiusValue,
} from '../src/examples/metric-values';

describe('metric-values validation', () => {
  it('mass roundtrip conversion works', () => {
    const kg = createKg(82.5);
    const lb = kilogramsToPounds(kg);
    const kgBack = poundsToKilograms(lb);

    expect(KgToolbox.parseId(kg).success).toBe(true);
    expect(LbToolbox.parseId(lb).success).toBe(true);
    expect(Math.abs(Number(kgBack.split('_')[1]) - 82.5)).toBeLessThan(1e-3);
  });

  it('length roundtrip conversion works', () => {
    const m = createM(10);
    const ft = metersToFeet(m);
    const mBack = feetToMeters(ft);

    expect(MToolbox.parseId(m).success).toBe(true);
    expect(FtToolbox.parseId(ft).success).toBe(true);
    expect(Math.abs(Number(mBack.split('_')[1]) - 10)).toBeLessThan(1e-3);
  });

  it('temperature conversions and constraints work', () => {
    const c = createDegC(100);
    const f = celsiusToFahrenheit(c);
    const cBack = fahrenheitToCelsius(f);
    const k = celsiusToKelvin(c);

    expect(DegCToolbox.parseId(c).success).toBe(true);
    expect(DegFToolbox.parseId(f).success).toBe(true);
    expect(KToolbox.parseId(k).success).toBe(true);
    expect(Math.abs(Number(cBack.split('_')[1]) - 100)).toBeLessThan(1e-3);

    expect(KToolbox.parseId('K_-10').success).toBe(false);
  });

  it('fahrenheit to kelvin composed conversion works', () => {
    const f = createDegF(98.6);
    const k = fahrenheitToKelvin(f);
    expect(KToolbox.parseId(k).success).toBe(true);
  });

  it('compile-time misuse is prevented for temperature brands', () => {
    const setThermostat = (_t: CelsiusValue): void => {};
    setThermostat(createDegC(20));

    // @ts-expect-error FahrenheitValue is not CelsiusValue
    setThermostat(createDegF(20));
    // @ts-expect-error KelvinValue is not CelsiusValue
    setThermostat(createK(293.15));
  });

  it('assertId works for valid metric values', () => {
    expect(() => KgToolbox.assertId('kg_10')).not.toThrow();
    expect(() => DegCToolbox.assertId('degC_-40')).not.toThrow();
    expect(() => KToolbox.assertId('K_-1')).toThrow();
  });

  it('construction helpers produce valid branded values', () => {
    expect(KgToolbox.parseId(createKg(1)).success).toBe(true);
    expect(LbToolbox.parseId(createLb(1)).success).toBe(true);
    expect(MToolbox.parseId(createM(1)).success).toBe(true);
    expect(FtToolbox.parseId(createFt(1)).success).toBe(true);
    expect(DegCToolbox.parseId(createDegC(-10)).success).toBe(true);
    expect(DegFToolbox.parseId(createDegF(-10)).success).toBe(true);
    expect(KToolbox.parseId(createK(10)).success).toBe(true);
  });

  it('kelvin to celsius conversion works', () => {
    const c = kelvinToCelsius(createK(273.15));
    expect(DegCToolbox.parseId(c).success).toBe(true);
    expect(Math.abs(Number(c.split('_')[1]) - 0)).toBeLessThan(1e-3);
  });
});
