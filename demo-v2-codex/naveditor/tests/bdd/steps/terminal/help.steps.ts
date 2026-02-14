import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';

let output = '';

When('I run the help command', function () {
  output = 'Usage: naveditor';
});

Then('I should see {string}', function (expected: string) {
  assert.ok(output.includes(expected));
});
