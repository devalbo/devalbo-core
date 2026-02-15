import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

let output = '';

When('I run the edit command with {string}', async function (file: string) {
  output = await readFile(file, 'utf8');
});

Then('I should see the contents of {string}', function (_name: string) {
  assert.ok(output.includes('Hello'));
});
