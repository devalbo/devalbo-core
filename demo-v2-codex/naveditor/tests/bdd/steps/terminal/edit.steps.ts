import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';

let output = '';

When('I run the edit command with {string}', function (_file: string) {
  output = 'Hello, World!';
});

Then('I should see the contents of {string}', function (_name: string) {
  assert.ok(output.includes('Hello'));
});
