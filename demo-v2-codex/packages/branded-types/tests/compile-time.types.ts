import type { IdTypePrefixBrand } from '../src/core/brand-types';
import {
  createBrandedPrefixKeyStringToolbox,
  type IKeyMethodology,
} from '../src/core/prefix-key-string';
import type { RegexableString } from '../src/core/brand-types';
import type { NumberIndexKeyValue } from '../src/methodologies/number-index-key';
import { createBrandedNumberIndexToolbox } from '../src/methodologies/number-index-key';
import { createBrandedUuidToolbox, type UuidKeyValue } from '../src/methodologies/uuid-key';
import {
  createBrandedNonNegativeIntSchema,
  createBrandedPositiveIntSchema,
} from '../src/numeric/branded-number';

const game = createBrandedUuidToolbox('game' as IdTypePrefixBrand);
const seat = createBrandedNumberIndexToolbox('seat' as IdTypePrefixBrand, '_');

const gameId = game.createIdForKey('550e8400-e29b-41d4-a716-446655440000' as UuidKeyValue);
const seatId = seat.createIdForKey('1' as NumberIndexKeyValue);

const acceptsGameId = (_id: typeof gameId): void => {};
const acceptsSeatId = (_id: typeof seatId): void => {};

acceptsGameId(gameId);
acceptsSeatId(seatId);

// @ts-expect-error number-index id should not be assignable to uuid id
acceptsGameId(seatId);
// @ts-expect-error uuid id should not be assignable to number-index id
acceptsSeatId(gameId);

const MillisecondsSchema = createBrandedNonNegativeIntSchema('Milliseconds');
const SecondsSchema = createBrandedPositiveIntSchema('Seconds');

const milliseconds = MillisecondsSchema.parse(1000);
const seconds = SecondsSchema.parse(1);

const takesMilliseconds = (_value: typeof milliseconds): void => {};

takesMilliseconds(milliseconds);
// @ts-expect-error Seconds brand should not be assignable to Milliseconds brand
takesMilliseconds(seconds);

const customMethod: IKeyMethodology<IdTypePrefixBrand, NumberIndexKeyValue> = {
  idPrefix: 'custom' as IdTypePrefixBrand,
  createIdPrefixRegexStr: (prefix) => prefix as unknown as RegexableString,
  keyRegexStr: '[0-9]+' as RegexableString,
};

const custom = createBrandedPrefixKeyStringToolbox(customMethod, ':');
const customId = custom.createIdForKey('9' as NumberIndexKeyValue);

const plainString: string = customId;
void plainString;
